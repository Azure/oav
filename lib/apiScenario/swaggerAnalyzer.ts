import { JSONPath } from "jsonpath-plus";
import { inject, injectable } from "inversify";
import _ from "lodash";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import { FileLoaderOption, FileLoader } from "../swagger/fileLoader";
import { JsonLoader, JsonLoaderOption, isRefLike } from "../swagger/jsonLoader";
import { SwaggerLoader, SwaggerLoaderOption } from "../swagger/swaggerLoader";
import {
  BodyParameter,
  Path,
  SwaggerExample,
  SwaggerSpec,
  refSelfSymbol,
  Schema,
} from "../swagger/swaggerTypes";
import { AjvSchemaValidator } from "../swaggerValidator/ajvSchemaValidator";
import { SchemaValidator } from "../swaggerValidator/schemaValidator";
import { allOfTransformer } from "../transform/allOfTransformer";
import { getTransformContext, TransformContext } from "../transform/context";
import { discriminatorTransformer } from "../transform/discriminatorTransformer";
import { noAdditionalPropertiesTransformer } from "../transform/noAdditionalPropertiesTransformer";
import { referenceFieldsTransformer } from "../transform/referenceFieldsTransformer";
import { resolveNestedDefinitionTransformer } from "../transform/resolveNestedDefinitionTransformer";
import { xmsPathsTransformer } from "../transform/xmsPathsTransformer";
import { applyGlobalTransformers, applySpecTransformers } from "../transform/transformer";
import { traverseSwaggerAsync } from "../transform/traverseSwagger";
import { getProvider } from "../util/utils";
import { setDefaultOpts } from "../swagger/loader";
import { ScenarioDefinition } from "./apiScenarioTypes";
import { SchemaSearcher } from "./schemaSearcher";
import { CoverageCalculator, OperationCoverageResult } from "./coverageCalculator";

export interface SwaggerAnalyzerOption
  extends FileLoaderOption,
    JsonLoaderOption,
    SwaggerLoaderOption {
  swaggerFilePaths?: string[];
  noExternalDependencyResourceType?: boolean;
  filerTopLevelResourceType?: boolean;
}

export interface ExampleDependency {
  exampleFilePath: string;
  exampleName: string;
  swaggerFilePath: string;
  apiVersion: string;
  resourceProvider: string;
  fullResourceType: string;
  operationId: string;
  internalDependency: Dependency;
  externalDependency: Dependency[];
}

function isTopLevelResource(exampleDependency: ExampleDependency): boolean {
  return exampleDependency.internalDependency.resourceChain.length === 1;
}

function noExternalDependency(exampleDependency: ExampleDependency): boolean {
  return exampleDependency.externalDependency.length === 0;
}

interface Dependency {
  resourceProvider: string;
  fullResourceType?: string;
  jsonPointer?: string;
  jsonPath?: string;
  resourceIdJsonPointer?: string;
  resourceChain: ResourceType[];
}

interface ResourceType {
  resourceType: string;
  resourceName: string;
}

@injectable()
export class SwaggerAnalyzer {
  private swaggerSpecs: SwaggerSpec[];
  private initialized: boolean = false;
  private transformContext: TransformContext;
  private schemaValidator: SchemaValidator;
  private resourceTypePathMapping: Map<string, Path[]>;
  private exampleDependencyMapping: Map<string, ExampleDependency>;
  private dependencyResult: ExampleDependency[];

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: SwaggerAnalyzerOption,
    public jsonLoader: JsonLoader,
    private swaggerLoader: SwaggerLoader,
    private fileLoader: FileLoader
  ) {
    this.swaggerSpecs = [];
    this.dependencyResult = [];
    this.schemaValidator = new AjvSchemaValidator(this.jsonLoader);
    this.transformContext = getTransformContext(this.jsonLoader, this.schemaValidator, [
      xmsPathsTransformer,
      resolveNestedDefinitionTransformer,
      referenceFieldsTransformer,

      discriminatorTransformer,
      allOfTransformer,
      noAdditionalPropertiesTransformer,
    ]);

    this.resourceTypePathMapping = new Map<string, Path[]>();
    this.exampleDependencyMapping = new Map<string, ExampleDependency>();
  }

  public static create(opts: SwaggerAnalyzerOption) {
    setDefaultOpts(opts, {
      eraseXmsExamples: false,
      eraseDescription: false,
      noExternalDependencyResourceType: false,
      filerTopLevelResourceType: false,
    });
    return inversifyGetInstance(SwaggerAnalyzer, opts);
  }

  public calculateOperationCoverage(testDef: ScenarioDefinition): OperationCoverageResult {
    return CoverageCalculator.calculateOperationCoverage(testDef, this.swaggerSpecs);
  }

  public calculateOperationCoverageBySpec(
    testDef: ScenarioDefinition
  ): Map<string, OperationCoverageResult> {
    return CoverageCalculator.calculateOperationCoverageBySpec(testDef, this.swaggerSpecs);
  }

  public async analyzeDependency(): Promise<ExampleDependency[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    const filterFunctions: any = [];
    if (this.opts.filerTopLevelResourceType) {
      filterFunctions.push(isTopLevelResource);
    }
    if (this.opts.noExternalDependencyResourceType) {
      filterFunctions.push(noExternalDependency);
    }
    const dependencyResult: ExampleDependency[] = [];
    for (const swaggerSpec of this.swaggerSpecs) {
      await traverseSwaggerAsync(swaggerSpec, {
        onPath: async (path, pathTemplate) => {
          const resourceChain = getResourceFromPath(pathTemplate);
          const resourceProvider = getProvider(pathTemplate);
          if (resourceProvider) {
            const resourceTypePath = getResourceTypePath(resourceChain, resourceProvider);
            const paths = this.resourceTypePathMapping.get(resourceTypePath) || [];
            paths.push(path);
            this.resourceTypePathMapping.set(resourceTypePath, paths);
            if (path.put !== undefined) {
              for (const [exampleName, example] of Object.entries(
                path.put["x-ms-examples"] || {}
              )) {
                let externalDependency = analyzeExampleDependency(
                  this.jsonLoader.resolveRefObj(example)
                );
                const parameters = path.put.parameters?.map((it) => {
                  if (isRefLike(it)) {
                    return this.jsonLoader.resolveRefObj(it);
                  } else {
                    return it;
                  }
                });
                const requestBody: BodyParameter = parameters?.filter(
                  (it: any) => it.in === "body"
                )[0] as BodyParameter;
                try {
                  externalDependency = externalDependency.map((dependency): Dependency => {
                    return {
                      ...dependency,
                      resourceIdJsonPointer: this.getResourceIdJsonPath(
                        dependency,
                        requestBody,
                        example
                      ),
                    };
                  });
                } catch (err) {
                  console.log(err);
                }

                const exampleDependency: ExampleDependency = {
                  apiVersion: swaggerSpec.info.version,
                  resourceProvider: resourceProvider,
                  swaggerFilePath: swaggerSpec._filePath,
                  exampleName: exampleName,
                  fullResourceType: getResourceTypePath(resourceChain, resourceProvider),
                  exampleFilePath: this.jsonLoader.getRealPath(example.$ref!),
                  externalDependency: externalDependency,
                  operationId: path.put.operationId || "",
                  internalDependency: {
                    resourceProvider: resourceProvider,
                    resourceChain: resourceChain,
                    fullResourceType: getResourceTypePath(resourceChain, resourceProvider),
                  },
                };
                dependencyResult.push(exampleDependency);
                this.exampleDependencyMapping.set(
                  exampleDependency.exampleFilePath,
                  exampleDependency
                );
              }
            }
          }
        },
      });
    }
    this.dependencyResult = dependencyResult.filter((it) =>
      filterFunctions.every((fun: any) => fun(it))
    );
    return this.dependencyResult;
  }

  public getPathByResourceType(resourceType: string): Path[] | undefined {
    return this.resourceTypePathMapping.get(resourceType);
  }

  public async getOperationListPath(): Promise<Path[]> {
    const ret: Path[] = [];
    for (const swaggerSpec of this.swaggerSpecs) {
      await traverseSwaggerAsync(swaggerSpec, {
        onPath: async (path, pathTemplate) => {
          const resourceProvider = getProvider(pathTemplate);
          if (resourceProvider) {
            const operationListPath = operationsPath(resourceProvider);
            if (path._pathTemplate === operationListPath) {
              ret.push(path);
            }
          }
        },
      });
    }
    return ret;
  }

  public getResourceIdJsonPath(
    dependency: Dependency,
    requestBody: BodyParameter,
    example: any
  ): string {
    const getSchemaJsonPointer = (jsonPointer: string) => {
      const ret = jsonPointer.substring(jsonPointer.indexOf("/", 1), jsonPointer.length);
      return ret;
    };

    const getSchemaName = (jsonPointer: string) => {
      const ret = jsonPointer.split("/")[1];
      return ret;
    };
    const schemaJsonPointer = getSchemaJsonPointer(dependency.jsonPointer!);
    const schemaName = getSchemaName(dependency.jsonPointer!);
    const exampleObj = this.jsonLoader.resolveRefObj(example);
    const schema = SchemaSearcher.findSchemaByJsonPointer(
      schemaJsonPointer,
      requestBody.schema!,
      this.jsonLoader,
      exampleObj.parameters[schemaName]
    );
    const resourceIdSchemaJsonPath = schema[refSelfSymbol];
    if (resourceIdSchemaJsonPath !== undefined) {
      return resourceIdSchemaJsonPath.substr(3, resourceIdSchemaJsonPath.length);
    } else {
      return "";
    }
  }

  public getExampleDependencyByExamplePath(exampleFilePath: string): ExampleDependency | undefined {
    return this.exampleDependencyMapping.get(exampleFilePath);
  }

  public async initialize() {
    if (this.initialized) {
      throw new Error("Already initialized");
    }
    for (const swaggerFilePath of this.opts.swaggerFilePaths ?? []) {
      const swaggerSpec = await this.swaggerLoader.load(swaggerFilePath);
      this.swaggerSpecs.push(swaggerSpec);
      applySpecTransformers(swaggerSpec, this.transformContext);
    }
    applyGlobalTransformers(this.transformContext);
    this.initialized = true;
  }

  public async getAllSecretKey(): Promise<string[]> {
    let ret: string[] = [];
    const allXmsSecretsPath = '$..[?(@["x-ms-secret"])]~';
    for (const swaggerPath of this.opts.swaggerFilePaths ?? []) {
      const swagger = JSON.parse(await this.fileLoader.load(swaggerPath));
      const allXmsSecretKeys = JSONPath({
        path: allXmsSecretsPath,
        json: swagger,
      });
      ret = ret.concat(allXmsSecretKeys);
    }
    return ret;
  }

  public findSchemaByJsonPointer(jsonPointer: string, schema: Schema, body?: any) {
    return SchemaSearcher.findSchemaByJsonPointer(jsonPointer, schema, this.jsonLoader, body);
  }
}

export function getResourceFromPath(pathTemplate: string): ResourceType[] {
  const provider = getProvider(pathTemplate);
  if (provider === undefined) {
    return [];
  }
  const resources = pathTemplate.substr(
    pathTemplate.indexOf(provider) + provider.length,
    pathTemplate.length
  );
  const resourceList = resources.split("/").filter((it) => it !== "");
  if (resourceList.length % 2 === 0) {
    const ret: ResourceType[] = [];
    for (let i = 0; i < resourceList.length / 2; i++) {
      ret.push({
        resourceType: resourceList[2 * i],
        resourceName: resourceList[2 * i + 1],
      });
    }
    return ret;
  }
  return [];
}

export function getResourceTypePath(resourceType: ResourceType[], resourceProvider: string) {
  return [resourceProvider, ...resourceType.map((it) => it.resourceType)].join("/");
}

export function operationsPath(resourceProvider: string): string {
  return `/providers/${resourceProvider}/operations`;
}

export function analyzeExampleDependency(example: SwaggerExample): Dependency[] {
  const ret: Dependency[] = [];
  const allElementValuePath = "$..*";
  const allParametersValues = JSONPath({
    path: allElementValuePath,
    json: example.parameters,
    resultType: "all",
  });
  const allElementKeyPath = "$..*~";
  const allParametersKeys = JSONPath({
    path: allElementKeyPath,
    json: example.parameters,
    resultType: "all",
  });
  const allParameters = _.concat(allParametersValues, allParametersKeys);
  for (const it of allParameters) {
    if (typeof it.value === "string" && (it.value as string).length > 0) {
      const provider = getProvider(it.value);
      if (provider !== undefined) {
        const resourceChain = getResourceFromPath(it.value);
        const resourceType = getResourceTypePath(resourceChain, provider);
        ret.push({
          resourceProvider: provider,
          resourceChain: resourceChain,
          fullResourceType: resourceType,
          jsonPointer: it.pointer,
          jsonPath: it.path,
        });
      }
    }
  }
  return ret;
}
export interface DependencyResult {
  apiVersion: string;
  exampleName: string;
  fullResourceType: string;
  resourceProvider: string;
  fullDependentResourceType: string;
  exampleJsonPointer: string;
  swaggerResourceIdJsonPath: string;
  swaggerFilePath: string;
  exampleFilePath: string;
  operationId: string;
}

export function normalizeDependency(
  res: ExampleDependency[],
  fileRoot = "specification"
): DependencyResult[] {
  const dependency: any = {};
  const vis = new Set<string>();
  res
    .filter((it) => it.externalDependency.length > 0)
    .map((it) => {
      return {
        swaggerFilePath: it.swaggerFilePath.substr(
          it.swaggerFilePath.indexOf(fileRoot),
          it.swaggerFilePath.length
        ),
        ids: it.externalDependency.map((dependency) => {
          return {
            apiVersion: it.apiVersion,
            exampleName: it.exampleName,
            fullResourceType: it.fullResourceType,
            resourceProvider: it.resourceProvider,
            fullDependentResourceType: dependency.fullResourceType,
            operationId: it.operationId,
            exampleJsonPointer: dependency.jsonPointer,
            swaggerResourceIdJsonPointer: dependency.resourceIdJsonPointer,
            exampleFilePath: it.exampleFilePath.substr(
              it.exampleFilePath.indexOf(fileRoot),
              it.exampleFilePath.length
            ),
          };
        }),
      };
    })
    .forEach((it) => {
      if (dependency[it.swaggerFilePath] === undefined) {
        dependency[it.swaggerFilePath] = [];
      }
      for (const id of it.ids) {
        if (
          !vis.has(uniqueIndex(id.exampleJsonPointer!, it.swaggerFilePath, id.fullResourceType!))
        ) {
          dependency[it.swaggerFilePath].push(id);
          vis.add(uniqueIndex(id.exampleJsonPointer!, it.swaggerFilePath, id.fullResourceType!));
        }
      }
    });
  let ret: DependencyResult[] = [];
  for (const [k, v] of Object.entries(dependency)) {
    ret = ret.concat(
      (v as any).map((it: any) => {
        return { ...it, swaggerFilePath: k };
      })
    );
  }
  return ret;
}

const uniqueIndex = (
  jsonPointer: string,
  swaggerFilePath: string,
  resourceType: string
): string => {
  return `${jsonPointer}_${swaggerFilePath}_${resourceType}`;
};
