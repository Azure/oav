/* eslint-disable require-atomic-updates */

import { join as pathJoin, dirname } from "path";
import { dump as yamlDump } from "js-yaml";
import { pickBy } from "lodash";
import { generate as jsonMergePatchGenerate } from "json-merge-patch";
import { inject, injectable } from "inversify";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
import { Loader, setDefaultOpts } from "../swagger/loader";
import { FileLoader, FileLoaderOption } from "../swagger/fileLoader";
import { JsonLoader, JsonLoaderOption } from "../swagger/jsonLoader";
import { getTransformContext, TransformContext } from "../transform/context";
import { SchemaValidator } from "../swaggerValidator/schemaValidator";
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
import {
  SwaggerSpec,
  Operation,
  SwaggerExample,
  Parameter,
  BodyParameter,
} from "../swagger/swaggerTypes";
import { traverseSwagger } from "../transform/traverseSwagger";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import {
  VariableScope,
  ScenarioDefinition,
  Scenario,
  Step,
  StepRestCall,
  StepArmTemplate,
  RawVariableScope,
  RawScenarioDefinition,
  RawStepArmTemplate,
  RawStep,
  RawStepRestCall,
  RawScenario,
  RawStepRawCall,
  StepRawCall,
  RawStepRestOperation,
  RawStepArmScript,
  ArmTemplate,
  VariableType,
} from "./apiScenarioTypes";
import { TemplateGenerator } from "./templateGenerator";
import { BodyTransformer } from "./bodyTransformer";
import { jsonPatchApply } from "./diffUtils";
import { ApiScenarioYamlLoader } from "./apiScenarioYamlLoader";
import { ApiScenarioRunner } from "./apiScenarioRunner";
import { VariableEnv } from "./variableEnv";

import armDeploymentScriptTemplate from "./templates/armScriptTemplate.json";

const variableRegex = /\$\(([A-Za-z_][A-Za-z0-9_]*)\)/;

export interface ApiScenarioLoaderOption
  extends FileLoaderOption,
    JsonLoaderOption,
    SwaggerLoaderOption {
  swaggerFilePaths?: string[];
}

interface Resource {
  identifier: SwaggerExample["parameters"];
  body: any;
}

interface ApiScenarioContext {
  stepTracking: Map<string, Step>;
  resourceTracking: Map<string, Resource>;
  scenarioDef: ScenarioDefinition;
  scenario?: Scenario;
}

@injectable()
export class ApiScenarioLoader implements Loader<ScenarioDefinition> {
  private transformContext: TransformContext;
  private exampleToOperation = new Map<string, { [operationId: string]: [Operation, string] }>();
  private nameToOperation: Map<string, Operation> = new Map();
  private initialized: boolean = false;
  private env: VariableEnv;
  private templateGenerationRunner: ApiScenarioRunner;

  public constructor(
    @inject(TYPES.opts) private opts: ApiScenarioLoaderOption,
    private fileLoader: FileLoader,
    public jsonLoader: JsonLoader,
    private swaggerLoader: SwaggerLoader,
    private apiScenarioYamlLoader: ApiScenarioYamlLoader,
    private templateGenerator: TemplateGenerator,
    private bodyTransformer: BodyTransformer,
    @inject(TYPES.schemaValidator) private schemaValidator: SchemaValidator
  ) {
    setDefaultOpts(opts, {
      swaggerFilePaths: [],
    });

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
    this.env = new VariableEnv();
    this.templateGenerationRunner = new ApiScenarioRunner({
      env: this.env,
      jsonLoader: this.jsonLoader,
      client: this.templateGenerator,
      loadMode: true,
    });
  }

  public static create(opts: ApiScenarioLoaderOption) {
    setDefaultOpts(opts, {
      eraseXmsExamples: false,
      eraseDescription: false,
      skipResolveRefKeys: ["x-ms-examples"],
    });
    return inversifyGetInstance(ApiScenarioLoader, opts);
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

          if (this.nameToOperation.has(operation.operationId)) {
            throw new Error(
              `Duplicated operationId ${operation.operationId}: ${
                operation._path._pathTemplate
              }\nConflict with path: ${
                this.nameToOperation.get(operation.operationId)?._path._pathTemplate
              }`
            );
          }
          this.nameToOperation.set(operation.operationId, operation);

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

    this.initialized = true;
  }

  public async writeTestDefinitionFile(filePath: string, testDef: RawScenarioDefinition) {
    const fileContent = yamlDump(testDef);
    return this.fileLoader.writeFile(filePath, fileContent);
  }

  public async load(filePath: string): Promise<ScenarioDefinition> {
    if (!this.initialized) {
      await this.initialize();
    }

    const rawDef = await this.apiScenarioYamlLoader.load(filePath);

    const scenarioDef: ScenarioDefinition = {
      scope: rawDef.scope ?? "ResourceGroup",
      prepareSteps: [],
      scenarios: [],
      _filePath: this.fileLoader.relativePath(filePath),
      cleanUpSteps: [],
      ...convertVariables(rawDef.variables),
    };

    if (scenarioDef.scope === "ResourceGroup") {
      const requiredVariables = new Set(scenarioDef.requiredVariables);
      requiredVariables.add("subscriptionId");
      requiredVariables.add("location");
      scenarioDef.requiredVariables = [...requiredVariables];
    }

    const ctx: ApiScenarioContext = {
      stepTracking: new Map(),
      resourceTracking: new Map(),
      scenarioDef: scenarioDef,
    };

    for (const rawStep of rawDef.prepareSteps ?? []) {
      const step = await this.loadStep(rawStep, ctx);
      step.isPrepareStep = true;
      scenarioDef.prepareSteps.push(step);
    }

    for (const rawStep of rawDef.cleanUpSteps ?? []) {
      const step = await this.loadStep(rawStep, ctx);
      step.isCleanUpStep = true;
      scenarioDef.cleanUpSteps.push(step);
    }

    for (const rawScenario of rawDef.scenarios) {
      const scenario = await this.loadScenario(rawScenario, ctx);
      scenarioDef.scenarios.push(scenario);
    }

    await this.templateGenerationRunner.cleanAllScope();

    return scenarioDef;
  }

  private async loadScenario(rawScenario: RawScenario, ctx: ApiScenarioContext): Promise<Scenario> {
    const resolvedSteps: Step[] = [];
    const steps: Step[] = [];
    const { scenarioDef } = ctx;

    for (const step of scenarioDef.prepareSteps) {
      resolvedSteps.push(step);
    }

    const variableScope = convertVariables(rawScenario.variables);
    variableScope.requiredVariables = [
      ...new Set([...scenarioDef.requiredVariables, ...variableScope.requiredVariables]),
    ];

    const scenario: Scenario = {
      scenario: rawScenario.scenario,
      description: rawScenario.description ?? "",
      shareScope: rawScenario.shareScope ?? true,
      steps,
      _resolvedSteps: resolvedSteps,
      _scenarioDef: scenarioDef,
      ...variableScope,
    };
    ctx.scenario = scenario;

    for (const rawStep of rawScenario.steps) {
      const step = await this.loadStep(rawStep, ctx);
      resolvedSteps.push(step);
      steps.push(step);
    }

    for (const step of scenarioDef.cleanUpSteps) {
      resolvedSteps.push(step);
    }

    await this.generateTemplate(scenario);

    return scenario;
  }

  private async generateTemplate(scenario: Scenario) {
    this.env.clear();
    for (const requiredVar of scenario.requiredVariables) {
      this.env.set(requiredVar, `$(${requiredVar})`);
    }
    await this.templateGenerationRunner.executeScenario(scenario);
  }

  private async loadStep(rawStep: RawStep, ctx: ApiScenarioContext): Promise<Step> {
    let testStep: Step;

    try {
      if ("exampleFile" in rawStep || "operationId" in rawStep) {
        testStep = await this.loadStepRestCall(rawStep, ctx);
      } else if ("armTemplate" in rawStep) {
        testStep = await this.loadStepArmTemplate(rawStep, ctx);
      } else if ("armDeploymentScript" in rawStep) {
        testStep = await this.loadStepArmDeploymentScript(rawStep, ctx);
      } else if ("rawUrl" in rawStep) {
        testStep = await this.loadStepRawCall(rawStep, ctx);
      } else {
        throw new Error("Invalid step");
      }
    } catch (error) {
      throw new Error(`Failed to load step ${rawStep.step}: ${(error as any).message}`);
    }

    if (ctx.scenario !== undefined) {
      declareOutputVariables(testStep.outputVariables, ctx.scenario);
    } else {
      declareOutputVariables(testStep.outputVariables, ctx.scenarioDef);
    }
    return testStep;
  }

  private async loadStepRawCall(
    rawStep: RawStepRawCall,
    _ctx: ApiScenarioContext
  ): Promise<StepRawCall> {
    const step: StepRawCall = {
      type: "rawCall",
      ...rawStep,
      statusCode: rawStep.statusCode ?? 200,
      outputVariables: rawStep.outputVariables ?? {},
      ...convertVariables(rawStep.variables),
    };
    return step;
  }

  private async loadStepArmDeploymentScript(
    rawStep: RawStepArmScript,
    ctx: ApiScenarioContext
  ): Promise<StepArmTemplate> {
    const step: StepArmTemplate = {
      type: "armTemplateDeployment",
      step: rawStep.step,
      outputVariables: rawStep.outputVariables ?? {},
      armTemplate: "",
      armTemplatePayload: {},
      ...convertVariables(rawStep.variables),
    };
    const { scenarioDef } = ctx;

    const payload = cloneDeep(armDeploymentScriptTemplate) as ArmTemplate;
    step.armTemplatePayload = payload;

    const resource = payload.resources![0];
    resource.name = rawStep.step;

    if (rawStep.armDeploymentScript.endsWith(".ps1")) {
      resource.kind = "AzurePowerShell";
      resource.properties.azPowerShellVersion = "6.2";
    } else {
      resource.kind = "AzureCLI";
      resource.properties.azCliVersion = "2.0.80";
    }

    const filePath = pathJoin(dirname(scenarioDef._filePath), rawStep.armDeploymentScript);
    const scriptContent = await this.fileLoader.load(filePath);
    resource.properties.scriptContent = scriptContent;

    for (const variable of rawStep.environmentVariables ?? []) {
      if (this.getVariableType(variable.value, step, ctx) === "secureString") {
        resource.properties.environmentVariables!.push({
          name: variable.name,
          secureValue: variable.value,
        });
      } else {
        resource.properties.environmentVariables!.push({
          name: variable.name,
          value: variable.value,
        });
      }
    }

    return step;
  }

  private getVariableType(variable: string, step: Step, ctx: ApiScenarioContext): VariableType {
    const { scenarioDef, scenario } = ctx;

    if (variableRegex.test(variable)) {
      const globalRegex = new RegExp(variableRegex, "g");
      let match;
      while ((match = globalRegex.exec(variable))) {
        const refKey = match[1];
        if (
          step.secretVariables.includes(refKey) ||
          scenario?.secretVariables.includes(refKey) ||
          scenarioDef.secretVariables.includes(refKey)
        ) {
          return "secureString";
        }
      }
    }

    return "string";
  }

  private async loadStepArmTemplate(
    rawStep: RawStepArmTemplate,
    ctx: ApiScenarioContext
  ): Promise<StepArmTemplate> {
    const step: StepArmTemplate = {
      type: "armTemplateDeployment",
      step: rawStep.step,
      outputVariables: rawStep.outputVariables ?? {},
      armTemplate: rawStep.armTemplate,
      armTemplatePayload: {},
      ...convertVariables(rawStep.variables),
    };
    const { scenarioDef, scenario } = ctx;
    const variableScope: VariableScope = scenario ?? scenarioDef;

    const filePath = pathJoin(dirname(scenarioDef._filePath), step.armTemplate);
    const armTemplateContent = await this.fileLoader.load(filePath);
    step.armTemplatePayload = JSON.parse(armTemplateContent);

    const params = step.armTemplatePayload.parameters;
    if (params !== undefined) {
      for (const paramName of Object.keys(params)) {
        if (
          params[paramName].defaultValue !== undefined ||
          step.variables[paramName] !== undefined ||
          variableScope.variables[paramName] !== undefined ||
          scenarioDef.variables[paramName] !== undefined
        ) {
          continue;
        }
        if (
          params[paramName].type !== "string" &&
          params[paramName].type !== "securestring" &&
          !variableScope.requiredVariables.includes(paramName)
        ) {
          throw new Error(
            `Only string and securestring type is supported in arm template params, please specify defaultValue for: ${paramName}`
          );
        }
        variableScope.requiredVariables.push(paramName);
      }
    }

    const outputs = step.armTemplatePayload.outputs;
    if (outputs !== undefined) {
      declareOutputVariables(outputs, variableScope);
    }

    return step;
  }

  private async loadStepRestCall(
    rawStep: RawStepRestCall | RawStepRestOperation,
    ctx: ApiScenarioContext
  ): Promise<StepRestCall> {
    if (ctx.stepTracking.has(rawStep.step)) {
      throw new Error(`Duplicated step name: ${rawStep.step}`);
    }

    const step: StepRestCall = {
      type: "restCall",
      step: rawStep.step,
      description: rawStep.description,
      resourceName: rawStep.resourceName,
      exampleFile: "",
      operationId: "",
      operation: {} as Operation,
      requestParameters: {} as SwaggerExample["parameters"],
      expectedResponse: {},
      exampleName: "",
      statusCode: rawStep.statusCode ?? 200,
      outputVariables: rawStep.outputVariables ?? {},
      resourceUpdate: rawStep.resourceUpdate ?? [],
      requestUpdate: rawStep.requestUpdate ?? [],
      responseUpdate: rawStep.responseUpdate ?? [],
      ...convertVariables(rawStep.variables),
    };

    ctx.stepTracking.set(step.step, step);

    if ("exampleFile" in rawStep) {
      step.exampleFile = rawStep.exampleFile;
      await this.loadRestCallExample(step, ctx);
    } else if ("operationId" in rawStep) {
      step.operationId = rawStep.operationId;
      await this.loadRestCallOperation(step, ctx);
    }

    if (step.requestUpdate.length > 0) {
      jsonPatchApply(step.requestParameters, step.requestUpdate);
    }
    if (step.responseUpdate.length > 0) {
      jsonPatchApply(step.expectedResponse, step.responseUpdate);
    }

    return step;
  }

  private async loadRestCallOperation(
    step: StepRestCall,
    ctx: ApiScenarioContext
  ): Promise<StepRestCall> {
    const resource = ctx.resourceTracking.get(step.resourceName!);
    if (resource === undefined) {
      throw new Error(`Unknown resourceName: ${step.resourceName} in step ${step.step}`);
    }

    const operation = this.nameToOperation.get(step.operationId);
    if (operation === undefined) {
      throw new Error(`Operation not found for ${step.operationId} in step ${step.step}`);
    }
    step.operation = operation;

    const target = cloneDeep(resource.body);
    if (step.resourceUpdate.length > 0) {
      jsonPatchApply(target, step.resourceUpdate);
    }
    const bodyParam = getBodyParam(step.operation, this.jsonLoader);

    switch (step.operation._method) {
      case "put":
        step.requestParameters = { ...resource.identifier };
        if (bodyParam !== undefined) {
          step.requestParameters[bodyParam.name] = await this.bodyTransformer.resourceToRequest(
            target,
            bodyParam.schema!
          );
        }
        step.expectedResponse = await this.bodyTransformer.resourceToResponse(
          target,
          step.operation.responses[step.statusCode].schema!
        );
        break;
      case "get":
        step.requestParameters = { ...resource.identifier };
        step.expectedResponse = await this.bodyTransformer.resourceToResponse(
          target,
          step.operation.responses[step.statusCode].schema!
        );
        break;
      case "patch":
        step.requestParameters = { ...resource.identifier };
        if (bodyParam !== undefined) {
          step.requestParameters[bodyParam.name] = pickBy(
            target,
            (_, propertyName) =>
              propertyName !== "properties" &&
              propertyName !== "id" &&
              propertyName !== "name" &&
              propertyName !== "type" &&
              propertyName !== "location" &&
              propertyName !== "systemData"
          );
          const propertiesMergePatch = jsonMergePatchGenerate(
            resource.body.properties,
            target.properties
          );
          if (propertiesMergePatch !== undefined) {
            step.requestParameters[bodyParam.name].properties = propertiesMergePatch;
          }
        }
        step.expectedResponse = await this.bodyTransformer.resourceToResponse(
          target,
          step.operation.responses[step.statusCode].schema!
        );
        break;
      case "delete":
        step.requestParameters = { ...resource.identifier };
        break;
      case "post":
        step.requestParameters = { ...resource.identifier };
        break;
      default:
        throw new Error(`Unsupported operation ${step.operationId}`);
    }

    resource.body = target;

    return step;
  }

  private async loadRestCallExample(step: StepRestCall, ctx: ApiScenarioContext) {
    const filePath = step.exampleFile;
    if (filePath === undefined) {
      throw new Error(`RestCall step must specify "exampleFile" or "operationName"`);
    }

    const exampleFilePath = pathJoin(dirname(ctx.scenarioDef._filePath), filePath);

    // Load example file
    const fileContent = await this.fileLoader.load(exampleFilePath);
    const exampleFileContent = JSON.parse(fileContent) as SwaggerExample;

    step.requestParameters = exampleFileContent.parameters;
    step.expectedResponse = exampleFileContent.responses[step.statusCode]?.body;

    // Load Operation
    const opMap = exampleFileContent.operationId
      ? this.nameToOperation.get(exampleFileContent.operationId)
      : this.exampleToOperation.get(exampleFilePath);
    if (opMap === undefined) {
      throw new Error(`Example file is not referenced by any operation: ${filePath}`);
    }
    const ops = Object.values(opMap);
    if (ops.length > 1) {
      throw new Error(
        `Example file is referenced by multiple operation: ${Object.keys(opMap)} ${filePath}`
      );
    }
    [step.operation, step.exampleName] = ops[0];
    step.operationId = step.operation.operationId!;

    if (step.resourceUpdate.length > 0) {
      if (!["put", "patch", "get"].includes(step.operation._method)) {
        throw new Error(
          `resourceUpdate could only be used in PUT/PATCH/GET operations with exampleFile`
        );
      }

      const target = cloneDeep(step.expectedResponse);
      const bodyParam = getBodyParam(step.operation, this.jsonLoader);
      if (bodyParam !== undefined) {
        try {
          this.bodyTransformer.deepMerge(target, step.requestParameters[bodyParam.name]);
        } catch (err) {
          console.error(err);
        }
      }
      jsonPatchApply(target, step.resourceUpdate);

      if (bodyParam !== undefined) {
        const convertedRequest = await this.bodyTransformer.resourceToRequest(
          target,
          bodyParam.schema!
        );
        step.requestParameters[bodyParam.name] = convertedRequest;
      }

      step.expectedResponse = await this.bodyTransformer.resourceToResponse(
        target,
        step.operation.responses[step.statusCode].schema!
      );
    }

    if (step.resourceName) {
      if (!["put", "patch", "get"].includes(step.operation._method)) {
        throw new Error(
          `resourceName could only be used in PUT/PATCH/GET operations with exampleFile`
        );
      }
      const pathParams = pickParams(step.operation, "path", this.jsonLoader);
      const identifier = pickBy(
        step.requestParameters,
        (_, paramName) =>
          "api-version" === paramName ||
          pathParams?.find((param) => param.name === paramName) !== undefined
      ) as SwaggerExample["parameters"];
      ctx.resourceTracking.set(step.resourceName, {
        identifier,
        body: step.expectedResponse,
      });
    }
  }
}

export const getBodyParam = (operation: Operation, jsonLoader: JsonLoader) => {
  const bodyParams = pickParams(operation, "body", jsonLoader) as BodyParameter[] | undefined;
  return bodyParams?.[0];
};

const pickParams = (operation: Operation, location: Parameter["in"], jsonLoader: JsonLoader) => {
  const params = operation.parameters
    ?.map((param) => jsonLoader.resolveRefObj(param))
    .filter((resolvedObj) => resolvedObj.in === location);
  return params;
};

const convertVariables = (rawVariables: RawVariableScope["variables"]) => {
  const result: VariableScope = {
    variables: {},
    requiredVariables: [],
    secretVariables: [],
  };
  for (const [key, val] of Object.entries(rawVariables ?? {})) {
    if (typeof val === "string") {
      result.variables[key] = val;
    } else {
      if (val.defaultValue !== undefined) {
        result.variables[key] = val.defaultValue;
      } else {
        result.requiredVariables.push(key);
      }
      if (val.type === "secureString") {
        result.secretVariables.push(key);
      }
    }
  }
  return result;
};

const declareOutputVariables = (
  outputVariables: { [key: string]: { type?: any } },
  scope: VariableScope
) => {
  for (const [key, val] of Object.entries(outputVariables)) {
    if (scope.variables[key] === undefined) {
      scope.variables[key] = `$(${key})`;
    }
    if (val.type === "secureString" || val.type === "securestring") {
      scope.secretVariables.push(key);
    }
  }
};
