import Heap from "heap";
import { inject, injectable } from "inversify";
import { dump } from "js-yaml";
import { pathJoin, pathResolve } from "@azure-tools/openapi-tools-common";
import { inversifyGetInstance, TYPES } from "../../inversifyUtils";
import { FileLoader } from "../../swagger/fileLoader";
import { JsonLoader } from "../../swagger/jsonLoader";
import { SwaggerLoader } from "../../swagger/swaggerLoader";
import { SwaggerSpec, LowerHttpMethods, Schema, Parameter } from "../../swagger/swaggerTypes";
import { traverseSwagger } from "../../transform/traverseSwagger";
import { ApiScenarioLoaderOption } from "../apiScenarioLoader";
import {
  RawScenario,
  RawScenarioDefinition,
  RawStepOperation,
  Variable,
  VarValue,
} from "../apiScenarioTypes";
import * as util from "../../generator/util";
import { setDefaultOpts } from "../../swagger/loader";
import Mocker from "../../generator/mocker";

export interface ApiScenarioGeneratorOption extends ApiScenarioLoaderOption {
  swaggerFilePaths: string[];
  dependencyPath: string;
  outputDir: string;
}

interface Dependency {
  producer_endpoint: string;
  producer_method: string;
  producer_resource_name: string;
  consumer_param: string;
}

interface Dependencies {
  [path: string]: {
    [method: string]: {
      Path?: Dependency[];
      Query?: Dependency[];
    };
  };
}

interface Node {
  operationId: string;
  method: LowerHttpMethods;
  children: Map<string, Node>;
  inDegree: number;
  outDegree: number;
  visited: boolean;
  priority: number;
}

const methodOrder: LowerHttpMethods[] = ["put", "get", "patch", "post", "delete"];

const envVariables = ["api-version", "subscriptionId", "resourceGroupName", "location"];

@injectable()
export class ApiScenarioGenerator {
  private swaggers: SwaggerSpec[];
  private graph: Map<string, Node>;
  private mocker: Mocker;

  public constructor(
    @inject(TYPES.opts) private opts: ApiScenarioGeneratorOption,
    private swaggerLoader: SwaggerLoader,
    private fileLoader: FileLoader,
    private jsonLoader: JsonLoader
  ) {
    this.swaggers = [];
    this.mocker = new Mocker();
  }

  public static create(opts: ApiScenarioGeneratorOption) {
    setDefaultOpts(opts, {
      swaggerFilePaths: [],
      outputDir: ".",
      dependencyPath: "",
    });
    return inversifyGetInstance(ApiScenarioGenerator, opts);
  }

  public async initialize() {
    this.opts.outputDir = pathResolve(this.opts.outputDir);
    this.opts.swaggerFilePaths = this.opts.swaggerFilePaths.map((p) => pathResolve(p));
    for (const path of this.opts.swaggerFilePaths) {
      const swagger = await this.swaggerLoader.load(path);
      this.swaggers.push(swagger);
    }
    await this.generateGraph();
  }

  public async generate() {
    const definition: RawScenarioDefinition = {
      scope: "ResourceGroup",
      variables: undefined,
      scenarios: [],
    };
    definition.scenarios.push(this.generateSteps());
    this.getVariables(definition);

    await this.writeFile(definition);
  }

  private async writeFile(definition: RawScenarioDefinition) {
    const fileContent = dump(definition);
    const filePath = pathJoin(this.opts.outputDir, "basic.yaml");
    await this.fileLoader.writeFile(filePath, fileContent);
    console.log(`${filePath} is generated.`);
  }

  private getVariables(definition: RawScenarioDefinition) {
    const variables: { [name: string]: string | Variable } = {};
    const map = new Map();

    for (const swagger of this.swaggers) {
      traverseSwagger(swagger, {
        onOperation: (operation) => {
          for (let parameter of operation.parameters ?? []) {
            parameter = this.jsonLoader.resolveRefObj(parameter);
            if (!parameter.required || envVariables.includes(parameter.name)) {
              continue;
            }

            let key: any = parameter.name;

            if (parameter.in === "body") {
              key = this.jsonLoader.resolveRefObj(parameter.schema!);
            }

            const value = map.get(key);

            if (value) {
              value.count++;
            } else {
              map.set(key, {
                operationId: operation.operationId,
                name: parameter.name,
                count: 1,
                value: this.generateVariable(parameter),
              });
            }
          }
        },
      });
    }

    [...map.values()]
      .sort((a, b) => b.count - a.count)
      .forEach((v) => {
        if (!variables[v.name] && v.count > 1) {
          variables[v.name] = v.value;
          return;
        }

        const step = definition.scenarios[0].steps.find(
          (s) => (s as RawStepOperation).operationId === v.operationId
        )!;
        if (!step.variables) {
          step.variables = {};
        }

        step.variables[v.name] = v.value;
      });

    definition.variables = variables;
  }

  private generateVariable(parameter: Parameter): Variable | string {
    const genValue = (name: string, schema: Schema): VarValue => {
      if (util.isObject(schema)) {
        const ret: VarValue = {};
        for (const name of schema.required ?? []) {
          const prop = this.jsonLoader.resolveRefObj(schema.properties![name]);
          ret[name] = genValue(name, prop);
        }

        for (const allOf of schema.allOf ?? []) {
          const prop = this.jsonLoader.resolveRefObj(allOf);
          const value = genValue("", prop) as { [key: string]: VarValue };
          for (const key of Object.keys(value)) {
            ret[key] = value[key];
          }
        }
        return ret;
      }

      if (schema.default) {
        return schema.default;
      }

      if (schema.enum) {
        return schema.enum[0];
      }

      if (schema.type === "string" && envVariables.includes(name)) {
        return `$(${name})`;
      }

      if (schema.type === "array") {
        const prop = this.jsonLoader.resolveRefObj(schema.items!) as Schema;
        return this.mocker.mock(schema, name, genValue("", prop));
      }

      return this.mocker.mock(schema, name);
    };

    if (parameter.in === "body") {
      const schema = this.jsonLoader.resolveRefObj(parameter.schema!);
      const value: Variable = {
        type: "object",
        value: genValue(parameter.name, schema) as { [key: string]: VarValue },
      };
      return value;
    }

    return this.mocker.mock(parameter, parameter.name);
  }

  private generateSteps() {
    const scenario: RawScenario = {
      steps: [],
    };

    const heap = new Heap<Node>((a, b) => {
      const priority = b.priority - a.priority;
      if (priority) {
        return priority;
      }

      const degree = b.outDegree - a.outDegree;
      if (degree) {
        return degree;
      }
      return methodOrder.indexOf(a.method) - methodOrder.indexOf(b.method);
    });

    for (const node of this.graph.values()) {
      if (node.operationId.includes("CheckNameAvailability")) {
        scenario.steps.push({ operationId: node.operationId });
        node.visited = true;
        continue;
      }
      if (node.inDegree === 0 && node.method === "put") {
        heap.push(node);
      }
    }

    const deleteStack: Node[] = [];

    while (!heap.empty()) {
      const node = heap.pop()!;
      if (node.visited) {
        console.error("node is visited: ", node.operationId, node.method);
        continue;
      }
      node.visited = true;

      scenario.steps.push({ operationId: node.operationId });
      const operation = node.operationId.split("_")[0];

      for (const n of node.children.values()) {
        n.inDegree--;
        if (n.inDegree === 0 && n.method === "put") {
          heap.push(n);
        }
      }

      if (node.method !== "put") {
        continue;
      }

      for (const n of this.graph.values()) {
        if (n.inDegree === 0 && !n.visited && n.operationId.split("_")[0] === operation) {
          n.priority = 1;
          if (n.method === "delete") {
            n.visited = true;
            deleteStack.push(n);
          } else {
            heap.push(n);
          }
        }
      }
    }

    for (const node of this.graph.values()) {
      if (!node.visited) {
        scenario.steps.push({ operationId: node.operationId });
        if (node.inDegree !== 0) {
          console.error("node inDegree is not 0 ", node.operationId, node.method);
        }
      }
    }

    while (deleteStack.length > 0) {
      const node = deleteStack.pop()!;
      scenario.steps.push({ operationId: node.operationId });
    }

    return scenario;
  }

  private async generateGraph() {
    this.graph = new Map<string, Node>();
    const dependencies = (await this.jsonLoader.load(this.opts.dependencyPath)) as Dependencies;
    for (const path of Object.keys(dependencies)) {
      if (!path.startsWith("/")) {
        continue;
      }
      for (const method of Object.keys(dependencies[path])) {
        const operationId = this.getOperationId(path, method);
        if (!operationId) {
          console.warn(`can't find operationId, ${path} ${method}`);
          continue;
        }
        const node = this.getNode(operationId);
        node.method = method.toLowerCase() as LowerHttpMethods;

        for (const dependency of [
          ...(dependencies[path][method].Path ?? []),
          ...(dependencies[path][method].Query ?? []),
        ]) {
          if (dependency.producer_endpoint && dependency.producer_method) {
            const producerOperationId = this.getOperationId(
              dependency.producer_endpoint,
              dependency.producer_method
            );
            this.addDependency(operationId, producerOperationId);
          }
        }
      }
    }
  }

  private addDependency(operationId: string, producerOperationId: string) {
    const node = this.getNode(operationId);
    const dependNode = this.getNode(producerOperationId);

    node.inDegree++;
    dependNode.children.set(operationId, node);
    dependNode.outDegree++;
  }

  private getNode(operationId: string) {
    if (!this.graph.has(operationId)) {
      const node: Node = {
        operationId: operationId,
        children: new Map<string, Node>(),
        inDegree: 0,
        outDegree: 0,
        visited: false,
        method: "get",
        priority: 0,
      };
      this.graph.set(operationId, node);
    }

    return this.graph.get(operationId)!;
  }

  private getOperationId(path: string, method: string) {
    const m = method.toLowerCase() as LowerHttpMethods;
    for (const spec of this.swaggers) {
      const operationId = spec.paths[path]?.[m]?.operationId;
      if (operationId) {
        return operationId;
      }
    }
    return "";
  }
}
