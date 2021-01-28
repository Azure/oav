/* eslint-disable require-atomic-updates */
import { join as pathJoin, dirname } from "path";
import { safeDump, safeLoad } from "js-yaml";
import { default as AjvInit, ValidateFunction } from "ajv";
import { JSONPath } from "jsonpath-plus";
import { inject, injectable } from "inversify";
import { Loader, setDefaultOpts } from "../swagger/loader";
import { FileLoader, FileLoaderOption } from "../swagger/fileLoader";
import { JsonLoader, JsonLoaderOption } from "../swagger/jsonLoader";
import { getTransformContext, TransformContext } from "../transform/context";
import { SchemaValidator } from "../swaggerValidator/schemaValidator";
import { AjvSchemaValidator } from "../swaggerValidator/ajvSchemaValidator";
import { xmsPathsTransformer } from "../transform/xmsPathsTransformer";
import { resolveNestedDefinitionTransformer } from "../transform/resolveNestedDefinitionTransformer";
import { referenceFieldsTransformer } from "../transform/referenceFieldsTransformer";
import { discriminatorTransformer } from "../transform/discriminatorTransformer";
import { allOfTransformer } from "../transform/allOfTransformer";
import { noAdditionalPropertiesTransformer } from "../transform/noAdditionalPropertiesTransformer";
import { nullableTransformer } from "../transform/nullableTransformer";
import { pureObjectTransformer } from "../transform/pureObjectTransformer";
import { SwaggerLoader, SwaggerLoaderOption } from "../swagger/swaggerLoader";
import { applySpecTransformers, applyGlobalTransformers } from "../transform/transformer";
import { SwaggerSpec, Operation } from "../swagger/swaggerTypes";
import { traverseSwagger } from "../transform/traverseSwagger";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import {
  TestDefinitionSchema,
  TestDefinitionFile,
  TestScenario,
  TestStep,
  TestStepExampleFileRestCall,
  TestStepArmTemplateDeployment,
} from "./testResourceTypes";
import { ExampleTemplateGenerator } from "./exampleTemplateGenerator";

const ajv = new AjvInit({
  useDefaults: true,
});

export interface TestResourceLoaderOption
  extends FileLoaderOption,
    JsonLoaderOption,
    SwaggerLoaderOption {
  swaggerFilePaths?: string[];
}

@injectable()
export class TestResourceLoader implements Loader<TestDefinitionFile> {
  private transformContext: TransformContext;
  private schemaValidator: SchemaValidator;
  private validateTestResourceFile: ValidateFunction;
  private exampleToOperation: Map<
    string,
    { [operationId: string]: [Operation, string] }
  > = new Map();
  private initialized: boolean = false;
  private exampleTemplateGenerator: ExampleTemplateGenerator;

  public constructor(
    @inject(TYPES.opts) private opts: TestResourceLoaderOption,
    private fileLoader: FileLoader,
    public jsonLoader: JsonLoader,
    private swaggerLoader: SwaggerLoader
  ) {
    setDefaultOpts(opts, {
      swaggerFilePaths: [],
    });

    this.schemaValidator = new AjvSchemaValidator(this.jsonLoader);
    this.exampleTemplateGenerator = new ExampleTemplateGenerator(this.jsonLoader);

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

    this.validateTestResourceFile = ajv.compile(TestDefinitionSchema);
  }

  public static create(opts: TestResourceLoaderOption) {
    setDefaultOpts(opts, {
      eraseXmsExamples: false,
      eraseDescription: false,
      skipResolveRefKeys: ["x-ms-examples"],
    });
    return inversifyGetInstance(TestResourceLoader, opts);
  }

  public async initialize() {
    if (this.initialized) {
      throw new Error("Already initialized");
    }

    const allSpecs: SwaggerSpec[] = [];
    for (const swaggerFilePath of this.opts.swaggerFilePaths ?? []) {
      const swaggerSpec = await this.swaggerLoader.load(swaggerFilePath);
      allSpecs.push(swaggerSpec);
      applySpecTransformers(swaggerSpec, this.transformContext);
    }
    applyGlobalTransformers(this.transformContext);

    for (const spec of allSpecs) {
      traverseSwagger(spec, {
        onOperation: (operation) => {
          if (operation.operationId === undefined) {
            throw new Error(
              `OperationId is undefined for operation ${operation._method} ${operation._path._pathTemplate}`
            );
          }

          const xMsExamples = operation["x-ms-examples"] ?? {};
          for (const exampleName of Object.keys(xMsExamples)) {
            const example = xMsExamples[exampleName];
            if (typeof example.$ref !== "string") {
              throw new Error(`Example doesn't use $ref: ${exampleName}`);
            }
            const exampleFilePath = this.jsonLoader.getRealPath(example.$ref);
            let opMap = this.exampleToOperation.get(exampleFilePath);
            if (opMap === undefined) {
              opMap = {};
              this.exampleToOperation.set(exampleFilePath, opMap);
            }
            opMap[operation.operationId] = [operation, exampleName];
          }
        },
      });
    }
  }

  public async writeTestDefinitionFile(filePath: string, testDef: TestDefinitionFile) {
    const fileContent = safeDump(testDef);
    return this.fileLoader.writeFile(filePath, fileContent);
  }

  public async load(filePath: string): Promise<TestDefinitionFile> {
    if (!this.initialized) {
      await this.initialize();
    }

    const fileContent = await this.fileLoader.load(filePath);
    const filePayload = safeLoad(fileContent);
    if (!this.validateTestResourceFile(filePayload)) {
      const err = this.validateTestResourceFile.errors![0];
      throw new Error(
        `Failed to validate test resource file ${filePath}: ${err.dataPath} ${err.message}`
      );
    }
    const testDef = filePayload as TestDefinitionFile;
    testDef._filePath = this.fileLoader.relativePath(filePath);

    if (testDef.scope === "ResourceGroup") {
      const requiredVariables = new Set(testDef.requiredVariables);
      requiredVariables.add("subscriptionId");
      requiredVariables.add("location");
      testDef.requiredVariables = [...requiredVariables];
    }

    for (const step of testDef.prepareSteps) {
      step.isScopePrepareStep = true;
      await this.loadTestStep(step, testDef);
    }

    for (const testScenario of testDef.testScenarios) {
      await this.loadTestScenario(testScenario, testDef);
    }

    return filePayload;
  }

  private async loadTestScenario(testScenario: TestScenario, testDef: TestDefinitionFile) {
    testScenario._testDef = testDef;
    const resolvedSteps: TestStep[] = [];
    testScenario._resolvedSteps = resolvedSteps;

    const requiredVariables = new Set([
      ...testScenario.requiredVariables,
      ...testDef.requiredVariables,
    ]);
    testScenario.requiredVariables = [...requiredVariables];

    for (const step of testDef.prepareSteps) {
      resolvedSteps.push(step);
    }

    for (const step of testScenario.steps) {
      await this.loadTestStep(step, testDef, testScenario);
      resolvedSteps.push(step);
    }

    await this.exampleTemplateGenerator.generateExampleTemplateForTestScenario(testScenario);
  }

  private async loadTestStep(
    step: TestStep,
    testDef: TestDefinitionFile,
    testScenario?: TestScenario
  ) {
    if ("armTemplateDeployment" in step) {
      await this.loadTestStepArmTemplate(step, testDef, testScenario);
    } else if ("exampleFile" in step) {
      await this.loadTestStepExampleFileRestCall(step, testDef);
    } else {
      throw new Error(`Unknown step type: ${JSON.stringify(step)}`);
    }
  }

  private async loadTestStepArmTemplate(
    step: TestStepArmTemplateDeployment,
    testDef: TestDefinitionFile,
    testScenario?: TestScenario
  ) {
    step.type = "armTemplateDeployment";
    const filePath = pathJoin(dirname(testDef._filePath), step.armTemplateDeployment);
    const armTemplateContent = await this.fileLoader.load(filePath);
    step.armTemplatePayload = JSON.parse(armTemplateContent);

    const definedParameters = [];
    if (step.armTemplateParameters !== undefined) {
      const armTemplateParametersPath = pathJoin(
        dirname(testDef._filePath),
        step.armTemplateParameters
      );
      const armTemplateParametersContent = await this.fileLoader.load(armTemplateParametersPath);
      step.armTemplateParametersPayload = JSON.parse(armTemplateParametersContent);
      definedParameters.push(...Object.keys(step.armTemplateParametersPayload!.parameters));
    }
    const definedParameterSet = new Set(definedParameters);

    const params = step.armTemplatePayload.parameters;
    if (params !== undefined) {
      for (const paramName of Object.keys(params)) {
        if (definedParameterSet.has(paramName) || params[paramName].defaultValue !== undefined) {
          continue;
        }
        if (params[paramName].type !== "string") {
          throw new Error(
            `Only string type is supported in arm template params, please specify defaultValue or add it in arm template parameter file with armTemplateParameters: ${paramName}`
          );
        }
        if (testScenario !== undefined) {
          testScenario.requiredVariables.push(paramName);
        } else {
          testDef.requiredVariables.push(paramName);
        }
      }
    }
  }

  private async loadTestStepExampleFileRestCall(
    step: TestStepExampleFileRestCall,
    testDef: TestDefinitionFile
  ) {
    step.type = "exampleFile";
    const filePath = pathJoin(dirname(testDef._filePath), step.exampleFile);
    step.exampleFilePath = filePath;

    // Load Operation
    const opMap = this.exampleToOperation.get(filePath);
    if (opMap === undefined) {
      throw new Error(`Example file is not referenced by any operation: ${filePath}`);
    }

    if (step.operationId !== undefined) {
      [step.operation, step.exampleId] = opMap[step.operationId];
      if (step.operation === undefined) {
        throw new Error(
          `Example file with operationId is not found in swagger: ${step.operationId} ${filePath}`
        );
      }
    } else {
      const ops = Object.values(opMap);
      if (ops.length > 1) {
        throw new Error(
          `Example file is referenced by multiple operation: ${Object.keys(opMap)} ${filePath}`
        );
      }
      [step.operation, step.exampleId] = ops[0];
    }

    // Load example file
    const fileContent = await this.fileLoader.load(filePath);
    step.exampleFileContent = JSON.parse(fileContent);
    step.exampleTemplate = JSON.parse(fileContent);

    // Handle replace
    for (const { pathInExample, pathInBody, to } of step.replace) {
      if (pathInExample !== undefined) {
        replaceObjInPath(step.exampleTemplate, pathInExample, to);
      }
      if (pathInBody !== undefined) {
        const bodyParamName = step.operation.parameters?.filter(
          (param) => this.jsonLoader.resolveRefObj(param).in === "body"
        )[0]?.name;
        if (bodyParamName !== undefined) {
          replaceObjInPath(step.exampleTemplate.parameters[bodyParamName], pathInBody, to);
        }
        for (const code of Object.keys(step.exampleTemplate.responses)) {
          replaceObjInPath(step.exampleTemplate.responses[code], pathInBody, to);
        }
      }
    }
  }
}

const replaceObjInPath = (obj: any, path: string, replaceTo: string) => {
  const resultArr = JSONPath({
    path,
    json: obj,
    resultType: "all",
  });
  for (const result of resultArr) {
    if (result.parent === null) {
      throw new Error(`Cannot replace top level object: ${path}`);
    }
    result.parent[result.parentProperty] = replaceTo;
  }
};
