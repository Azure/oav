import Heap from "heap";
import * as path from "path";
import { inject, injectable } from "inversify";
import { dump } from "js-yaml";
import { pathJoin, pathResolve } from "@azure-tools/openapi-tools-common";
import { inversifyGetInstance, TYPES } from "../../inversifyUtils";
import { FileLoader } from "../../swagger/fileLoader";
import { JsonLoader } from "../../swagger/jsonLoader";
import { SwaggerLoader } from "../../swagger/swaggerLoader";
import {
  SwaggerSpec,
  LowerHttpMethods,
  Schema,
  Parameter,
  Operation,
} from "../../swagger/swaggerTypes";
import { traverseSwagger } from "../../transform/traverseSwagger";
import { ApiScenarioLoaderOption } from "../apiScenarioLoader";
import {
  RawScenario,
  RawScenarioDefinition,
  RawStepExample,
  RawStepOperation,
  Variable,
  VarValue,
} from "../apiScenarioTypes";
import * as util from "../../generator/util";
import { setDefaultOpts } from "../../swagger/loader";
import Mocker from "../../generator/mocker";
import { cloneDeep } from "lodash";

export interface ApiScenarioGeneratorOption extends ApiScenarioLoaderOption {
  swaggerFilePaths: string[];
  dependencyPath: string;
  outputDir: string;
  useExample?: boolean;
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

export const useRandom = {
  flag: true,
};

@injectable()
export class RestlerApiScenarioGenerator {
  private swaggers: SwaggerSpec[];
  private graph: Map<string, Node>;
  private mocker: any;
  private operations: Map<string, Operation>;

  public constructor(
    @inject(TYPES.opts) private opts: ApiScenarioGeneratorOption,
    private swaggerLoader: SwaggerLoader,
    private fileLoader: FileLoader,
    private jsonLoader: JsonLoader
  ) {
    this.swaggers = [];
    this.mocker = useRandom.flag
      ? new Mocker()
      : {
          mock: (paramSpec: any): any => {
            switch (paramSpec.type) {
              case "string":
                return "test";
              case "integer":
                return 1;
              case "number":
                return 1;
              case "boolean":
                return true;
              case "array":
                return [];
            }
          },
        };
  }

  public static create(opts: ApiScenarioGeneratorOption) {
    setDefaultOpts(opts, {
      swaggerFilePaths: [],
      outputDir: ".",
      dependencyPath: "",
      eraseXmsExamples: false,
      skipResolveRefKeys: ["x-ms-examples"],
    });
    return inversifyGetInstance(RestlerApiScenarioGenerator, opts);
  }

  public async initialize() {
    this.opts.outputDir = pathResolve(this.opts.outputDir);
    this.opts.swaggerFilePaths = this.opts.swaggerFilePaths.map((p) => pathResolve(p));
    this.operations = new Map();
    for (const path of this.opts.swaggerFilePaths) {
      const swagger = await this.swaggerLoader.load(path);
      this.swaggers.push(swagger);
      traverseSwagger(swagger, {
        onOperation: (operation) => {
          this.operations.set(operation.operationId!, operation);
        },
      });
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

    if (this.opts.useExample) {
      definition.scenarios[0].steps.forEach((step) => {
        const operationId = (step as any).operationId;
        const operation = this.operations.get(operationId);
        if (operation?.["x-ms-examples"] && Object.values(operation["x-ms-examples"])[0]) {
          const example = Object.values(operation["x-ms-examples"])[0];
          step.step = (step as any).operationId;
          (step as any).operationId = undefined;
          (step as RawStepExample).exampleFile = path.relative(
            this.opts.outputDir,
            this.jsonLoader.getRealPath(example.$ref!)
          );
        } else {
          console.warn(`${operationId} has no example.`);
        }
      });

      definition.scenarios[0].steps = definition.scenarios[0].steps.filter(
        (s) => (s as RawStepExample).exampleFile
      );
    }

    return definition;
  }

  public async writeFile(definition: RawScenarioDefinition) {
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
        const operation = this.operations.get(v.operationId);
        if (this.opts.useExample) {
          let p = operation?.parameters?.find((p) => {
            p = this.jsonLoader.resolveRefObj(p);
            return p.name === v.name;
          });
          if (p) {
            p = this.jsonLoader.resolveRefObj(p);
          }
          if (p?.in !== "path") {
            return;
          }
        }

        const step = definition.scenarios[0].steps.find(
          (s) => (s as RawStepOperation).operationId === v.operationId
        )!;

        if (!variables[v.name] && v.count > 1) {
          variables[v.name] = v.value;
          return;
        }

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
        const allOf = [...(schema.allOf ?? []), ...(schema.oneOf ?? [])];
        const s = {
          required: cloneDeep(schema.required) ?? [],
          properties: cloneDeep(schema.properties) ?? {},
        };
        while (allOf.length > 0) {
          const item = this.jsonLoader.resolveRefObj(allOf.shift()!);
          allOf.push(...(item.allOf ?? []), ...(item.oneOf ?? []));
          s.required = [...s.required, ...(item.required ?? [])];
          s.properties = { ...s.properties, ...(item.properties ?? {}) };
        }

        for (const name of s.required) {
          const prop = this.jsonLoader.resolveRefObj(s.properties[name]);
          ret[name] = genValue(name, prop);
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

    if (parameter.in === "path" && parameter.type === "string") {
      return { type: "string", prefix: `${parameter.name.toLocaleLowerCase().substring(0, 10)}` };
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
        node.visited = true;
      }
    }

    const deleteStack: Node[] = [];

    while (!heap.empty()) {
      const node = heap.pop()!;

      scenario.steps.push({ operationId: node.operationId });
      const operation = node.operationId.split("_")[0];

      for (const n of node.children.values()) {
        n.inDegree--;
        if (n.inDegree === 0 && n.method === "put") {
          heap.push(n);
          n.visited = true;
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
            n.visited = true;
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
