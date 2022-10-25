import { existsSync, writeFileSync } from "fs";
import { mkdirpSync } from "fs-extra";
import { injectable } from "inversify";
import { dump } from "js-yaml";
import _ from "lodash";
import { dirname, join, relative, resolve } from "path";
import { inversifyGetInstance } from "../../inversifyUtils";
import { JsonLoader } from "../../swagger/jsonLoader";
import { setDefaultOpts } from "../../swagger/loader";
import { SwaggerLoader, SwaggerLoaderOption } from "../../swagger/swaggerLoader";
import { Path, SwaggerSpec } from "../../swagger/swaggerTypes";
import { traverseSwagger, traverseSwaggers } from "../../transform/traverseSwagger";
import { xmsLongRunningOperation } from "../../util/constants";
import {
  RawScenario,
  RawScenarioDefinition,
  RawStep,
  RawStepExample,
  RawStepOperation,
} from "../apiScenarioTypes";
import { ApiScenarioYamlLoader } from "../apiScenarioYamlLoader";
import { RestlerApiScenarioGenerator } from "./restlerApiScenarioGenerator";
import { NoChildResourceCreated } from "./rules/noChildResourceCreated";
import { ResourceNameCaseInsensitive } from "./rules/resourceNameCaseInsensitive";
import { SystemDataExistsInResponse } from "./rules/systemDataExistsInResponse";

export type HttpVerb = "get" | "put" | "post" | "patch" | "delete" | "head";
export type ArmResourceKind = "Tracked" | "Proxy" | "Extension" | "None";
export type ResourceBasicOperationKind = "Get" | "CreateOrUpdate" | "Update" | "Delete";
export type ResourceOperationKind = ResourceBasicOperationKind | "Action" | "List";
export type PlatFormType = "RPaaS" | "ARM";

export type ApiTestGeneratorRule = {
  name: string;
  description: string;
  armRpcCodes?: string[];
  resourceKinds?: ArmResourceKind[];
  appliesTo: PlatFormType[];
  useExample?: boolean;
  generator: ApiTestGenerator;
};

type ApiTestGenerator = (resource: ArmResourceManipulator, base: RawScenario) => RawScenario | null;

type ResourceOperation = {
  path: string;
  operationId: string;
  parameters?: [];
  responses?: { [index: string]: any };
  examples: string[];
  [xmsLongRunningOperation]?: boolean;
  kind: ResourceOperationKind;
};

export interface ArmResourceManipulatorInterface {
  getResourceOperation(kind: ResourceBasicOperationKind): ResourceOperation;
  getListOperations(): ResourceOperation[];
  getResourceActions(): ResourceOperation[];
  getProperty(propName: string): any;
  getProperties(): any[];
  getParentResource(): ArmResourceManipulatorInterface[];
  getChildResource(): ArmResourceManipulatorInterface[];
}

/*
const ResourceBasicApiTestGenerator = {
  genResourceDependency: (resource: ArmResourceManipulator) => {

  },
  genBasic:(resource:ArmResourceManipulator)=> {},
  genResourceCreate: (resource: ArmResourceManipulator):RawStepOperation => {
    return {
      operationId: resource.getOperation("CreateOrUpdate")[0].operationId,
    }
  },
  genResourceUpdate: (resource: ArmResourceManipulator) => {},
  genResourceGet: (resource: ArmResourceManipulator) => {},
  genResourceDelete: (resource: ArmResourceManipulator) => {},
};*/

// the class for manipulate the resource , includeing
//  get CRUD, list, actions operations
export class ArmResourceManipulator implements ArmResourceManipulatorInterface {
  constructor(
    private swaggers: SwaggerSpec[],
    private jsonLoader: JsonLoader,
    private resAnalyzer: ArmResourceAnalyzer,
    private _resourceType: string,
    private path: string
  ) {}
  getListOperations(): ResourceOperation[] {
    return (
      this.resAnalyzer
        .getResourceActions()
        .filter((res) => res.resourceType === this.resourceType && res.isListResource())
        .map((res) => res.getOperation("List"))
        .reduce((pre, cur) => pre.concat(cur), []) || []
    );
  }
  getResourceActions(): ResourceOperation[] {
    return this.resAnalyzer
      .getResourceActions()
      .filter((res) => res.resourceType === this.resourceType && res.isListResource())
      .map((res) => res.getOperation("Action"))
      .reduce((pre, cur) => pre.concat(cur), []);
  }
  getResourceOperation(kind: ResourceBasicOperationKind): ResourceOperation {
    return this.getOperation(kind)?.[0];
  }
  get resourceType() {
    return this._resourceType;
  }
  public getOperation(kind: ResourceOperationKind): ResourceOperation[] {
    const ops: ResourceOperation[] = [];
    for (const swagger of this.swaggers) {
      traverseSwagger(swagger, {
        onPath: (path: Path, pathTemplate: string) => {
          if (pathTemplate === this.path) {
            function getHttpVerb(kind: ResourceOperationKind) {
              const map: { [index in ResourceOperationKind]: string } = {
                CreateOrUpdate: "put",
                Get: "get",
                Update: "patch",
                Delete: "delete",
                List: "get",
                Action: "post",
              };
              return map[kind] as string;
            }
            function getRawOperation(kind: ResourceOperationKind) {
              return (path as any)[getHttpVerb(kind)];
            }
            const rawOperation = getRawOperation(kind);
            if (rawOperation && rawOperation.operationId) {
              const operation = {
                operationId: rawOperation.operationId!,
                parameters: this.jsonLoader.resolveRefObj(rawOperation.parameters! as any),
                responses: this.jsonLoader.resolveRefObj(rawOperation.responses!),
                path: pathTemplate!,
                kind,
                examples: Object.values(rawOperation["x-ms-examples"] || {})?.map((e) =>
                  this.jsonLoader.getRealPath((e as any).$ref)
                ),
              };
              ops.push(operation);
            }
          }
        },
      });
    }

    return ops;
  }
  private getPropertyInternal(schema: any, propName: string): any {
    const resolvedSchema = this.jsonLoader.resolveRefObj(schema);
    if (resolvedSchema.properties) {
      if (propName in resolvedSchema.properties) {
        return resolvedSchema.properties[propName];
      }
    }
    if (resolvedSchema.allOf && Array.isArray(resolvedSchema.allOf)) {
      for (const base of resolvedSchema.allOf) {
        const result = this.getPropertyInternal(base, propName);
        if (result) {
          return result;
        }
      }
    }
    return undefined;
  }

  getProperty(propName: string): any {
    const response =
      this.getResourceOperation("CreateOrUpdate")?.responses?.["200"] ||
      this.getResourceOperation("CreateOrUpdate")?.responses?.["201"] ||
      this.getResourceOperation("Get")?.responses?.["200"];
    if (response?.schema) {
      return this.getPropertyInternal(response?.schema, propName);
    }
    return undefined;
  }
  getProperties(): any[] {
    return [];
  }

  public isTrackedResource() {
    const putOp = this.getOperation("CreateOrUpdate")?.[0];
    if (putOp) {
      return Object.entries(putOp.responses || [])
        .filter((entry) => entry[0] !== "default")
        .map((entry) => (entry[1] as any).schema)
        .some((schema) => schema && this.getPropertyInternal(schema, "location"));
    }
    return false;
  }

  public isExtensionResource() {
    const regEx = new RegExp(".*/providers/[^/]+/.*/providers/.*$", "gi");
    return regEx.test(this.path);
  }

  public isListResource() {
    const regex = /.*_list.*/gi;
    const matches = this.getOperation("Get")?.[0]?.operationId?.match(regex);
    return !!matches;
  }

  public isResourceAction() {
    const result = this.getOperation("Action")?.[0];
    return !!result;
  }

  private isSamePath(a: string, b: string) {
    const regex = /\{[\w\.]+\}/g;
    return a.replace(regex, "{}") === b.replace(regex, "{}");
  }
  private getParentResourcePath(path: string) {
    return path.split("/").slice(0, -2).join("/");
  }

  public getParentResource() {
    const parenetResPath = this.getParentResourcePath(this.path);
    return this.resAnalyzer
      .getResources()
      .filter((res) => this.isSamePath(res.path, parenetResPath));
  }
  public getChildResource() {
    return this.resAnalyzer
      .getResources()
      .filter((res) => this.isSamePath(this.getParentResourcePath(res.path), this.path));
  }
}

class ArmResourceDependencyGenerator {
  private _basicScenario: RawScenarioDefinition | undefined;
  constructor(
    private _swaggers: string[],
    private _dependencyFile: string,
    private _outPutDir: string,
    private _basicScenarioFile?: string
  ) {}
  async generate(resoure: ArmResourceManipulator, useExample?: boolean) {
    const restlerGenerator = RestlerApiScenarioGenerator.create({
      outputDir: this._outPutDir,
      dependencyPath: this._dependencyFile,
      swaggerFilePaths: this._swaggers,
      useExample: useExample,
    });
    await restlerGenerator.initialize();
    const baseScenario = await restlerGenerator.generateResourceDependency(resoure);
    if (this._basicScenarioFile) {
      const loader = inversifyGetInstance(ApiScenarioYamlLoader, {});
      const [scenario] = await loader.load(this._basicScenarioFile);
      this._basicScenario = scenario;
      // extract varaibles
      if (baseScenario.variables) {
        Object.keys(baseScenario.variables).forEach((v: string) => {
          if (scenario.variables?.[v]) {
            baseScenario.variables![v] = scenario.variables[v];
          }
        });
      }
      function resolveExampleFile(scenarioFile: string, exampleFile: string) {
        return resolve(dirname(scenarioFile), exampleFile);
      }
      const steps = baseScenario.steps as RawStepOperation[];
      const basicScenarioSteps = scenario.scenarios[0].steps as RawStepOperation[];
      // extract steps
      baseScenario.steps = steps.map((s) => {
        const found = basicScenarioSteps.find((basic) => s.operationId === basic.operationId);
        const exampleFile = (found as RawStepExample)?.exampleFile;
        return found
          ? exampleFile
            ? { ...found, exampleFile: resolveExampleFile(this._basicScenarioFile!, exampleFile) }
            : found
          : s;
      });
    }
    return baseScenario;
  }
  updateExampleFile(res: ArmResourceManipulator, scenario: RawScenario) {
    scenario.steps.forEach((s) => {
      if ("exampleFile" in s) {
        s.exampleFile = relative(resolve(this._outPutDir, res.resourceType, ".."), s.exampleFile);
      }
    });
  }

  getPrepareAndCleanUp(res: ArmResourceManipulator) {
    const updateStepFile = (res: ArmResourceManipulator, steps: RawStep[], baseFile: string) => {
      return steps.map((s) => {
        if ("armTemplate" in s) {
          s.armTemplate = relative(
            resolve(this._outPutDir, res.resourceType, ".."),
            resolve(dirname(baseFile), s.armTemplate)
          );
        }
        if ("armDeploymentScript" in s) {
          s.armDeploymentScript = relative(
            resolve(this._outPutDir, res.resourceType, ".."),
            resolve(dirname(baseFile), s.armDeploymentScript)
          );
        }
      });
    };
    if (!!this._basicScenarioFile) {
      [
        updateStepFile(res, this._basicScenario?.prepareSteps || [], this._basicScenarioFile),
        updateStepFile(res, this._basicScenario?.cleanUpSteps || [], this._basicScenarioFile),
      ];
    }
    return [this._basicScenario?.prepareSteps, this._basicScenario?.cleanUpSteps];
  }
}

class ArmResourceAnalyzer {
  private _resources: ArmResourceManipulator[] | undefined;
  private _actions: ArmResourceManipulator[] | undefined;
  constructor(private _swaggers: SwaggerSpec[], private _jsonLoader: JsonLoader) {
    this.getResources();
  }

  public getResourceType(path: string) {
    const index = path.lastIndexOf("/providers");
    if (index !== -1) {
      return path
        .substring(index + 1)
        .split("/")
        .slice(2)
        .filter((v, i) => v && !(i % 2))
        .join("/");
    }
    return "";
  }

  public getResources() {
    if (this._resources) {
      return this._resources;
    }
    this._resources = [];
    const specificResourcePathRegEx = new RegExp(
      "/providers/[^/]+(?:/\\w+/default|/\\w+/{[^/]+})+$",
      "gi"
    );
    traverseSwaggers(this._swaggers, {
      onPath: (path: Path, pathTemplate: string) => {
        const resType = this.getResourceType(pathTemplate);
        if (specificResourcePathRegEx.test(pathTemplate) && path.put && resType) {
          const resource = new ArmResourceManipulator(
            this._swaggers,
            this._jsonLoader,
            this,
            resType,
            pathTemplate
          );
          this._resources?.push(resource);
        }
      },
    });

    return this._resources;
  }

  public getResourceActions() {
    if (this._actions) {
      return this._actions;
    }
    const resourceActionRegEx = new RegExp(
      "/providers/[^/]+(?:/\\w+/\\w+|/\\w+/{[^/]+})*/\\w+$",
      "gi"
    );
    this._actions = [];
    traverseSwaggers(this._swaggers, {
      onPath: (_path: Path, pathTemplate: string) => {
        const resType = this.getResourceType(pathTemplate);
        if (resourceActionRegEx.test(pathTemplate) && resType) {
          const resourceMani = new ArmResourceManipulator(
            this._swaggers,
            this._jsonLoader,
            this,
            resType,
            pathTemplate
          );
          this._actions?.push(resourceMani);
        }
      },
    });
    return this._actions;
  }

  /**
   * /providers
   * /providers/NS/operations
   * /providers/Microsoft.Resources/checkResourceName
   * /subscription/{}
   * /subscription/{}/locations
   * /subscriptions
   * /{links}
   * /{applicationId}
   * subscription wide reads and actions
   * /subscriptions/{subscriptionId}/providers/Microsoft.Relay/checkNameAvailability
   */
  public getTalentAction() {}

  public getTrackedResource(): ArmResourceManipulator[] {
    return this.getResources().filter((res) => res.isTrackedResource());
  }

  public getProxyResource() {
    return this.getResources().filter((res) => !res.isTrackedResource());
  }

  public getExtensionResource() {
    return this.getResources().filter((res) => res.isExtensionResource());
  }
}

@injectable()
export class ApiTestRuleBasedGenerator {
  constructor(
    private swaggerLoader: SwaggerLoader,
    private jsonLoader: JsonLoader,
    private rules: ApiTestGeneratorRule[],
    private swaggerFiles: string[],
    private dependencyFile?: string,
    private basicScenarioFile?: string
  ) {}

  async run(outputDir: string, platFormType: PlatFormType) {
    const swaggerSpecs = await Promise.all(
      this.swaggerFiles.map((f) => this.swaggerLoader.load(f))
    );
    const analyzer = new ArmResourceAnalyzer(swaggerSpecs, this.jsonLoader);
    const trackedResources = analyzer.getTrackedResource();
    const proxyResources = analyzer.getProxyResource();
    const extensionResources = analyzer.getExtensionResource();
    const scenariosResult: { [index: string]: RawScenario } = {};
    const generateForResources = async (
      resources: ArmResourceManipulator[],
      kind: ArmResourceKind
    ) => {
      let base: RawScenario = { steps: [] };
      let dependency = this.dependencyFile
        ? new ArmResourceDependencyGenerator(
            this.swaggerFiles,
            this.dependencyFile,
            outputDir,
            this.basicScenarioFile
          )
        : undefined;

      for (const resource of resources) {
        const definition: RawScenarioDefinition = {
          scope: "ResourceGroup",
          variables: undefined,
          prepareSteps: undefined,
          scenarios: [],
          cleanUpSteps: undefined,
        };
        for (const rule of this.rules.filter(
          (rule) => rule.resourceKinds?.includes(kind) && rule.appliesTo.includes(platFormType)
        )) {
          // what if without dependency ??
          base = (await dependency?.generate(resource, rule.useExample)) || base;
          if (base) {
            const apiSenarios = rule.generator(resource, base);
            if (apiSenarios) {
              dependency?.updateExampleFile(resource, apiSenarios);
              scenariosResult[rule.name] = apiSenarios;
              definition.scenarios.push({ scenario: rule.name, ...apiSenarios });
            }
          }
        }
        if (definition.scenarios.length > 0) {
          const [prepare, cleanup] = dependency?.getPrepareAndCleanUp(resource) || [
            undefined,
            undefined,
          ];
          definition.prepareSteps = prepare;
          definition.cleanUpSteps = cleanup;
          this.writeFile(resource.resourceType, definition, outputDir);
        }
      }
    };
    await generateForResources(trackedResources, "Tracked");
    await generateForResources(proxyResources, "Proxy");
    await generateForResources(extensionResources, "Extension");
  }

  writeFile(resourType: string, definition: RawScenarioDefinition, outputDir: string) {
    const filePath = join(outputDir, `${resourType}.yaml`);
    if (!existsSync(dirname(filePath))) {
      mkdirpSync(dirname(filePath));
    }
    const fileContent =
      "# yaml-language-server: $schema=https://raw.githubusercontent.com/Azure/azure-rest-api-specs/main/documentation/api-scenario/references/v1.2/schema.json\n" +
      dump(definition);
    writeFileSync(filePath, fileContent);
    console.log(`${filePath} is generated.`);
  }
}

export const generateApiTestBasedOnRules = async (
  swaggers: string[],
  dependencyFile: string,
  outputDir: string,
  basicScenarioFile?: string,
  isRPaaS?: string
) => {
  const opts: SwaggerLoaderOption = {};
  setDefaultOpts(opts, {
    eraseXmsExamples: false,
    skipResolveRefKeys: ["x-ms-examples"],
  });
  const swaggerLoader = inversifyGetInstance(SwaggerLoader, opts);
  const jsonLoader = inversifyGetInstance(JsonLoader, opts);
  const rules: ApiTestGeneratorRule[] = [
    ResourceNameCaseInsensitive,
    SystemDataExistsInResponse,
    NoChildResourceCreated,
  ];
  const generator = new ApiTestRuleBasedGenerator(
    swaggerLoader,
    jsonLoader,
    rules,
    swaggers,
    dependencyFile,
    basicScenarioFile
  );
  await generator.run(outputDir, isRPaaS ? "RPaaS" : "ARM");
};
