import { JSONPath } from "jsonpath-plus";
import { inject, injectable } from "inversify";
import _ from "lodash";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import { FileLoaderOption } from "../swagger/fileLoader";
import { JsonLoader, JsonLoaderOption } from "../swagger/jsonLoader";
import { SwaggerLoader, SwaggerLoaderOption } from "../swagger/swaggerLoader";
import { Path, SwaggerExample, SwaggerSpec } from "../swagger/swaggerTypes";
import { AjvSchemaValidator } from "../swaggerValidator/ajvSchemaValidator";
import { SchemaValidator } from "../swaggerValidator/schemaValidator";
import { allOfTransformer } from "../transform/allOfTransformer";
import { getTransformContext, TransformContext } from "../transform/context";
import { discriminatorTransformer } from "../transform/discriminatorTransformer";
import { noAdditionalPropertiesTransformer } from "../transform/noAdditionalPropertiesTransformer";
import { nullableTransformer } from "../transform/nullableTransformer";
import { pureObjectTransformer } from "../transform/pureObjectTransformer";
import { referenceFieldsTransformer } from "../transform/referenceFieldsTransformer";
import { resolveNestedDefinitionTransformer } from "../transform/resolveNestedDefinitionTransformer";
import { xmsPathsTransformer } from "../transform/xmsPathsTransformer";
import { applyGlobalTransformers, applySpecTransformers } from "../transform/transformer";
import { traverseSwaggerAsync } from "../transform/traverseSwagger";
import { getProvider } from "../util/utils";
import { setDefaultOpts } from "./../swagger/loader";

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
  apiVersion: string;
  resourceProvider: string;
  resourceType: string;
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
    private swaggerLoader: SwaggerLoader // private bodyTransformer: BodyTransformer
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
      nullableTransformer,
      pureObjectTransformer,
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
                const externalDependency = analyzeExampleDependency(
                  this.jsonLoader.resolveRefObj(example)
                );
                const exampleDependency: ExampleDependency = {
                  apiVersion: swaggerSpec.info.version,
                  resourceProvider: resourceProvider,
                  exampleName: exampleName,
                  resourceType: getResourceTypePath(resourceChain, resourceProvider),
                  exampleFilePath: this.jsonLoader.getRealPath(example.$ref!),
                  externalDependency: externalDependency,
                  internalDependency: {
                    resourceProvider: resourceProvider,
                    resourceChain: resourceChain,
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
  }
}

function getResourceFromPath(pathTemplate: string): ResourceType[] {
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

function getResourceTypePath(resourceType: ResourceType[], resourceProvider: string) {
  return [resourceProvider, ...resourceType.map((it) => it.resourceType)].join("/");
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
        ret.push({ resourceProvider: provider, resourceChain: resourceChain });
      }
    }
  }
  return ret;
}
