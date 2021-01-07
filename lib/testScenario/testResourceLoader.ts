import { Loader } from "../swagger/loader";
import { FileLoaderOption, FileLoader } from "../swagger/fileLoader";
import { safeLoad } from "js-yaml";
import { JsonLoader, JsonLoaderOption } from "../swagger/jsonLoader";
import { default as AjvInit, ValidateFunction } from "ajv";
import { TestDefinitionSchema, TestDefinitionFile, TestScenario, TestStep, TestStepExampleFileRestCall, TestStepArmTemplateDeployment } from "./testResourceTypes";
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
import { SwaggerLoader } from "../swagger/swaggerLoader";
import { applySpecTransformers, applyGlobalTransformers } from "../transform/transformer";
import { SwaggerSpec, Operation } from "../swagger/swaggerTypes";
import { traverseSwagger } from "../transform/traverseSwagger";
import { join as pathJoin, dirname } from "path";

const ajv = new AjvInit({
  useDefaults: true
});


export interface TestResourceLoaderOption extends FileLoaderOption, JsonLoaderOption, SwaggerLoader {
  swaggerFilePaths: string[];
}

export class TestResourceLoader implements Loader<any> {
  private fileLoader: FileLoader;
  private jsonLoader: JsonLoader;
  private swaggerLoader: SwaggerLoader;
  private transformContext: TransformContext;
  private schemaValidator: SchemaValidator;
  private validateTestResourceFile: ValidateFunction;
  private exampleToOperation: Map<string, Operation> = new Map();

  constructor(private opts: TestResourceLoaderOption) {
    this.fileLoader = FileLoader.create(opts);
    this.jsonLoader = JsonLoader.create(opts);
    this.swaggerLoader = SwaggerLoader.create(opts);
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

    this.validateTestResourceFile = ajv.compile(TestDefinitionSchema);
  }

  public async initialize() {
    const allSpecs: SwaggerSpec[] = [];
    for (const swaggerFilePath of this.opts.swaggerFilePaths) {
      const swaggerSpec = await this.swaggerLoader.load(swaggerFilePath);
      allSpecs.push(swaggerSpec);
      applySpecTransformers(swaggerSpec, this.transformContext);
    }
    applyGlobalTransformers(this.transformContext);

    for (const spec of allSpecs) {
      traverseSwagger(spec, {
        onOperation: (operation: Operation) => {
          const xMsExamples = operation["x-ms-examples"] ?? {};
          for (const exampleName of Object.keys(xMsExamples)) {
            const example = xMsExamples[exampleName];
            if (typeof example.$ref !== "string") {
              throw new Error(`Example ${exampleName} doesn't use $ref`);
            }
            const exampleFilePath = pathJoin(dirname(spec._filePath), example.$ref);
            if (this.exampleToOperation.has(exampleFilePath)) {
              throw new Error(`Example ${exampleFilePath} is referenced by two operations`);
            }
            this.exampleToOperation.set(exampleFilePath, operation);
          }
        }
      });
    }
  }

  public async load(filePath: string): Promise<TestDefinitionFile> {
    const fileContent = await this.fileLoader.load(filePath);
    const filePayload = safeLoad(fileContent);
    if (!this.validateTestResourceFile(filePayload)) {
      const err = this.validateTestResourceFile.errors![0];
      throw new Error(`Failed to validate test resource file: ${err.dataPath} ${err.message}`);
    }
    const testDef = filePayload as TestDefinitionFile;
    testDef._filePath = this.fileLoader.relativePath(filePath);

    for (const step of testDef.prepareSteps) {
      step.isScopePrepareStep = true;
      this.loadTestStep(step, testDef);
    }

    for (const testScenario of testDef.testScenarios) {
      await this.loadTestScenario(testScenario, testDef);
    }

    return filePayload;
  }

  public async goThroughTestScenario(testScenario: TestScenario, visitors: {
    onStep: (testStep: TestStep, variableEnv: VariableEnvironment) => Promise<void>
  }) {

  }

  private async loadTestScenario(testScenario: TestScenario, testDef: TestDefinitionFile) {
    testScenario._testDef = testDef;
    const resolvedSteps: TestStep[] = [];
    testScenario._resolvedSteps = resolvedSteps;

    for (const step of testDef.prepareSteps) {
      resolvedSteps.push(step);
    }

    for (const step of testScenario.steps) {
      this.loadTestStep(step, testDef);
      resolvedSteps.push(step);
    }
  }

  private async loadTestStep(step: TestStep, testDef: TestDefinitionFile) {
    if ("armTemplateDeployment" in step) {
      await this.loadTestStepArmTemplate(step, testDef);
    } else if ("exampleFile" in step) {
      await this.loadTestStepExampleFileRestCall(step, testDef);
    } else {
      throw new Error(`Unknown step type: ${JSON.stringify(step)}`);
    }
  }

  private async loadTestStepArmTemplate(step: TestStepArmTemplateDeployment, testDef: TestDefinitionFile) {
    step.type = "armTemplateDeployment";
    const filePath = pathJoin(dirname(testDef._filePath), step.armTemplateDeployment);
    const armTemplateContent = await this.fileLoader.load(filePath);
    step.armTemplatePayload = JSON.parse(armTemplateContent);
  }

  private async loadTestStepExampleFileRestCall(step: TestStepExampleFileRestCall, testDef: TestDefinitionFile) {
    step.type = "exampleFile";
    const filePath = pathJoin(dirname(testDef._filePath), step.exampleFile);
    const operation = this.exampleToOperation.get(filePath);
    if (operation === undefined) {
      throw new Error(`Example file ${filePath} is not referenced by any operation`);
    }
    step.operation = operation;

    const fileContent = await this.fileLoader.load(filePath);
    step.exampleFileContent = JSON.parse(fileContent);

    step.exampleFileContent.parameters

  }
}
