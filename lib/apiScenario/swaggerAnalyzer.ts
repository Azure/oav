import { JSONPath } from "jsonpath-plus";
import { inject, injectable } from "inversify";
import _ from "lodash";
import { TYPES } from "../inversifyUtils";
import { FileLoaderOption, FileLoader } from "../swagger/fileLoader";
import { JsonLoader, JsonLoaderOption } from "../swagger/jsonLoader";
import { SwaggerLoader, SwaggerLoaderOption } from "../swagger/swaggerLoader";
import { Path, SwaggerSpec, Schema } from "../swagger/swaggerTypes";
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

@injectable()
export class SwaggerAnalyzer {
  private swaggerSpecs: SwaggerSpec[];
  private initialized: boolean = false;
  private transformContext: TransformContext;
  private schemaValidator: SchemaValidator;

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: SwaggerAnalyzerOption,
    public jsonLoader: JsonLoader,
    private swaggerLoader: SwaggerLoader,
    private fileLoader: FileLoader
  ) {
    this.swaggerSpecs = [];
    this.schemaValidator = new AjvSchemaValidator(this.jsonLoader);
    this.transformContext = getTransformContext(this.jsonLoader, this.schemaValidator, [
      xmsPathsTransformer,
      resolveNestedDefinitionTransformer,
      referenceFieldsTransformer,

      discriminatorTransformer,
      allOfTransformer,
      noAdditionalPropertiesTransformer,
    ]);
  }

  public calculateOperationCoverage(testDef: ScenarioDefinition): OperationCoverageResult {
    return CoverageCalculator.calculateOperationCoverage(testDef, this.swaggerSpecs);
  }

  public async getOperationListPath(): Promise<Path[]> {
    const ret: Path[] = [];
    for (const swaggerSpec of this.swaggerSpecs) {
      await traverseSwaggerAsync(swaggerSpec, {
        onPath: async (path, pathTemplate) => {
          const resourceProvider = getProvider(pathTemplate);
          if (resourceProvider) {
            if (path._pathTemplate === `/providers/${resourceProvider}/operations`) {
              ret.push(path);
            }
          }
        },
      });
    }
    return ret;
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
