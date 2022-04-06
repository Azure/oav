/* eslint-disable require-atomic-updates */

import { join as pathJoin, dirname } from "path";
import { dump as yamlDump } from "js-yaml";
import { generate as jsonMergePatchGenerate, apply as jsonMergeApply } from "json-merge-patch";
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
  RawStepExample,
  RawScenario,
  RawStepArmScript,
  ArmTemplate,
  ArmDeploymentScriptResource,
  RawStepOperation,
} from "./apiScenarioTypes";
import { TemplateGenerator } from "./templateGenerator";
import { jsonPatchApply } from "./diffUtils";
import { ApiScenarioYamlLoader } from "./apiScenarioYamlLoader";
import { armDeploymentScriptTemplate } from "./constants";
import { BodyTransformer } from "./bodyTransformer";

const variableRegex = /\$\(([A-Za-z_][A-Za-z0-9_]*)\)/;

export interface ApiScenarioLoaderOption
  extends FileLoaderOption,
    JsonLoaderOption,
    SwaggerLoaderOption {
  swaggerFilePaths?: string[];
}

interface ApiScenarioContext {
  stepTracking: Map<string, Step>;
  scenarioDef: ScenarioDefinition;
  scenario?: Scenario;
  scenarioIndex?: number;
  stepIndex?: number;
  stage?: "prepare" | "scenario" | "cleanUp";
}

@injectable()
export class ApiScenarioLoader implements Loader<ScenarioDefinition> {
  private transformContext: TransformContext;
  private operationsMap = new Map<string, Operation>();
  private apiVersionsMap = new Map<string, string>();
  private exampleToOperation = new Map<string, { [operationId: string]: string }>();
  private initialized: boolean = false;

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
  }

  public static create(opts: ApiScenarioLoaderOption) {
    setDefaultOpts(opts, {
      eraseXmsExamples: false,
      eraseDescription: false,
      skipResolveRefKeys: ["x-ms-examples"],
      swaggerFilePaths: [],
    });
    return inversifyGetInstance(ApiScenarioLoader, opts);
  }

  private async initialize(swaggerFilePaths?: string[]) {
    if (this.initialized) {
      throw new Error("Already initialized");
    }

    const allSpecs: SwaggerSpec[] = [];
    for (const swaggerFilePath of swaggerFilePaths ?? []) {
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

          if (this.operationsMap.has(operation.operationId)) {
            throw new Error(
              `Duplicated operationId ${operation.operationId}: ${
                operation._path._pathTemplate
              }\nConflict with path: ${
                this.operationsMap.get(operation.operationId)?._path._pathTemplate
              }`
            );
          }
          this.operationsMap.set(operation.operationId, operation);
          this.apiVersionsMap.set(operation.operationId, spec.info.version);

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
            opMap[operation.operationId] = exampleName;
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
    const rawDef = await this.apiScenarioYamlLoader.load(filePath);

    await this.initialize(this.opts.swaggerFilePaths);

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
      scenarioDef: scenarioDef,
      stepIndex: 0,
    };

    await this.loadPrepareSteps(rawDef, ctx);
    await this.loadCleanUpSteps(rawDef, ctx);

    ctx.scenarioIndex = 0;
    for (const rawScenario of rawDef.scenarios) {
      const scenario = await this.loadScenario(rawScenario, ctx);
      scenarioDef.scenarios.push(scenario);
      ctx.scenarioIndex++;
    }

    // await this.writeTestDefinitionFile("./test.yaml", scenarioDef);

    return scenarioDef;
  }

  private async loadPrepareSteps(rawDef: RawScenarioDefinition, ctx: ApiScenarioContext) {
    ctx.stage = "prepare";
    ctx.stepIndex = 0;
    for (const rawStep of rawDef.prepareSteps ?? []) {
      const step = await this.loadStep(rawStep, ctx);
      step.isPrepareStep = true;
      ctx.scenarioDef.prepareSteps.push(step);
    }
  }

  private async loadCleanUpSteps(rawDef: RawScenarioDefinition, ctx: ApiScenarioContext) {
    ctx.stage = "cleanUp";
    ctx.stepIndex = 0;
    for (const rawStep of rawDef.cleanUpSteps ?? []) {
      const step = await this.loadStep(rawStep, ctx);
      step.isCleanUpStep = true;
      ctx.scenarioDef.cleanUpSteps.push(step);
    }
  }

  private async loadScenario(rawScenario: RawScenario, ctx: ApiScenarioContext): Promise<Scenario> {
    ctx.stage = "scenario";
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
      scenario: rawScenario.scenario ?? `scenario_${ctx.scenarioIndex}`,
      description: rawScenario.description ?? "",
      shareScope: rawScenario.shareScope ?? true,
      steps,
      _resolvedSteps: resolvedSteps,
      _scenarioDef: scenarioDef,
      ...variableScope,
    };

    ctx.scenario = scenario;
    ctx.stepIndex = 0;

    for (const rawStep of rawScenario.steps) {
      const step = await this.loadStep(rawStep, ctx);
      resolvedSteps.push(step);
      steps.push(step);
    }

    for (const step of scenarioDef.cleanUpSteps) {
      resolvedSteps.push(step);
    }

    return scenario;
  }

  private async loadStep(rawStep: RawStep, ctx: ApiScenarioContext): Promise<Step> {
    let step: Step;

    try {
      if ("operationId" in rawStep || "exampleFile" in rawStep) {
        step = await this.loadStepRestCall(rawStep, ctx);
      } else if ("armTemplate" in rawStep) {
        step = await this.loadStepArmTemplate(rawStep, ctx);
      } else if ("armDeploymentScript" in rawStep) {
        step = await this.loadStepArmDeploymentScript(rawStep, ctx);
      } else {
        throw new Error("Invalid step");
      }
    } catch (error) {
      throw new Error(`Failed to load step ${rawStep.step}: ${(error as any).message}`);
    }

    if (step.outputVariables) {
      if (ctx.scenario !== undefined) {
        declareOutputVariables(step.outputVariables, ctx.scenario);
      } else {
        declareOutputVariables(step.outputVariables, ctx.scenarioDef);
      }
    }

    ctx.stepIndex!++;
    return step;
  }

  private async loadStepRestCall(
    rawStep: RawStepOperation | RawStepExample,
    ctx: ApiScenarioContext
  ): Promise<StepRestCall> {
    if (rawStep.step !== undefined && ctx.stepTracking.has(rawStep.step)) {
      throw new Error(`Duplicated step name: ${rawStep.step}`);
    }

    const step: StepRestCall = {
      type: "restCall",
      step: rawStep.step ?? `${ctx.scenarioIndex ?? ctx.stage}_${ctx.stepIndex}`,
      description: rawStep.description,
      operationId: "",
      operation: {} as Operation,
      requestParameters: {} as SwaggerExample["parameters"],
      responseExpected: {} as SwaggerExample["responses"],
      outputVariables: rawStep.outputVariables ?? {},
      ...convertVariables(rawStep.variables),
    };

    ctx.stepTracking.set(step.step, step);

    const getVariable = (name: string) => {
      const variable =
        step.variables[name] ?? ctx.scenario?.variables[name] ?? ctx.scenarioDef.variables[name];
      return variable;
    };

    if ("operationId" in rawStep) {
      step.operationId = rawStep.operationId;
      if (!rawStep.step) {
        step.step += `_${rawStep.operationId}`;
      }

      const operation = this.operationsMap.get(step.operationId);
      if (operation === undefined) {
        // TODO support cross-rp swagger
        throw new Error(`Operation not found for ${step.operationId} in step ${step.step}`);
      }
      step.operation = operation;

      if (rawStep.variables) {
        for (const [name, value] of Object.entries(rawStep.variables)) {
          if (typeof value === "string") {
            step.variables[name] = { type: "string", value };
            continue;
          }

          if (value.type === "object" || value.type === "secureObject" || value.type === "array") {
            if (value.patches) {
              const obj = cloneDeep(getVariable(name));
              if (typeof obj !== "object") {
                // TODO dynamic json patch
                throw new Error(`Can not Json Patch on ${name}, type of ${typeof obj}`);
              }
              jsonPatchApply(obj.value, value.patches);
              step.variables[name] = obj;
              continue;
            }
          }
          step.variables[name] = value;
        }
      }

      if (rawStep.parameters) {
        for (const [name, value] of Object.entries(rawStep.parameters)) {
          if (typeof value === "string") {
            step.variables[name] = { type: "string", value };
          } else if (Array.isArray(value)) {
            step.variables[name] = { type: "array", value };
          } else if (typeof value === "object") {
            step.variables[name] = { type: "object", value };
          } else if (typeof value === "boolean") {
            step.variables[name] = { type: "bool", value };
          } else if (typeof value === "number") {
            step.variables[name] = { type: "int", value };
          } else {
            throw new Error(`Invalid type of parameter ${name}`);
          }
        }
      }

      operation.parameters?.forEach((param) => {
        param = this.jsonLoader.resolveRefObj(param);
        if (param.name === "api-version") {
          return;
        }
        if (param.required) {
          if (param.type === "string") {
            step.requestParameters[param.name] = `$(${param.name})`;
          } else {
            step.requestParameters[param.name] = getVariable(param.name)!.value;
          }
        }
      });

      if (step.requestParameters["api-version"] === undefined) {
        step.requestParameters["api-version"] = this.apiVersionsMap.get(step.operationId)!;
      }
    } else {
      step.exampleFile = rawStep.exampleFile;

      const exampleFilePath = pathJoin(dirname(ctx.scenarioDef._filePath), step.exampleFile!);

      // Load example file
      const fileContent = await this.fileLoader.load(exampleFilePath);
      const exampleFileContent = JSON.parse(fileContent) as SwaggerExample;

      // Load Operation
      if (exampleFileContent.operationId) {
        step.operationId = exampleFileContent.operationId;

        const operation = this.operationsMap.get(step.operationId);
        if (operation === undefined) {
          // TODO support cross-rp swagger
          throw new Error(`Operation not found for ${step.operationId} in step ${step.step}`);
        }
        step.operation = operation;
      } else {
        const opMap = this.exampleToOperation.get(exampleFilePath);
        if (opMap === undefined) {
          throw new Error(`Example file is not referenced by any operation: ${step.exampleFile}`);
        }
        const ops = Object.keys(opMap);
        if (ops.length > 1) {
          throw new Error(
            `Example file is referenced by multiple operation: ${Object.keys(opMap)} ${
              step.exampleFile
            }`
          );
        }
        step.operationId = ops[0];
        const exampleName = opMap[step.operationId];
        step.operation = this.operationsMap.get(step.operationId)!;
        step.description = step.description ?? exampleName;
      }
      step.requestParameters = exampleFileContent.parameters;
      step.responseExpected = exampleFileContent.responses;

      await this.applyPatches(step, rawStep);
      this.templateGenerator.exampleParameterConvention(step, getVariable);
    }
    return step;
  }

  private async applyPatches(step: StepRestCall, rawStep: RawStepExample) {
    if (rawStep.requestUpdate) {
      const bodyParam = getBodyParam(step.operation, this.jsonLoader);
      let source;
      if (bodyParam) {
        source = cloneDeep(step.requestParameters[bodyParam.name]);
      }
      jsonPatchApply(step.requestParameters, rawStep.requestUpdate);
      if (["put", "patch"].includes(step.operation._method) && bodyParam) {
        const target = step.requestParameters[bodyParam.name];
        const propertiesMergePatch = jsonMergePatchGenerate(source, target);

        Object.entries(step.responseExpected).forEach(async (e) => {
          const statusCode = e[0];
          if (statusCode >= "400") {
            return;
          }
          const response = e[1];
          if (response.body) {
            jsonMergeApply(response.body, propertiesMergePatch);
            await this.bodyTransformer.resourceToResponse(
              response.body,
              step.operation.responses[statusCode].schema!
            );
          }
        });
      }
    }
    if (rawStep.responseUpdate) {
      jsonPatchApply(step.responseExpected, rawStep.responseUpdate);
    }
  }

  private async loadStepArmDeploymentScript(
    rawStep: RawStepArmScript,
    ctx: ApiScenarioContext
  ): Promise<StepArmTemplate> {
    const step: StepArmTemplate = {
      type: "armTemplateDeployment",
      step:
        rawStep.step ?? `${ctx.scenarioIndex ?? ctx.stage}_${ctx.stepIndex}_ArmDeploymentScript`,
      outputVariables: rawStep.outputVariables ?? {},
      armTemplate: "",
      armTemplatePayload: {},
      ...convertVariables(rawStep.variables),
    };
    const { scenarioDef } = ctx;

    const payload = cloneDeep(armDeploymentScriptTemplate) as ArmTemplate;
    step.armTemplatePayload = payload;

    const resource = payload.resources![0] as ArmDeploymentScriptResource;
    resource.name = step.step;

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
    resource.properties.arguments = rawStep.arguments;

    for (const variable of rawStep.environmentVariables ?? []) {
      if (this.isSecretVariable(variable.value, step, ctx)) {
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

  private isSecretVariable(variable: string, step: Step, ctx: ApiScenarioContext): boolean {
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
          return true;
        }
      }
    }

    return false;
  }

  private async loadStepArmTemplate(
    rawStep: RawStepArmTemplate,
    ctx: ApiScenarioContext
  ): Promise<StepArmTemplate> {
    const step: StepArmTemplate = {
      type: "armTemplateDeployment",
      step: rawStep.step ?? `${ctx.scenarioIndex ?? ctx.stage}_${ctx.stepIndex}_ArmTemplate`,
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
      result.variables[key] = {
        type: "string",
        value: val,
      };
    } else {
      if (val.value !== undefined) {
        result.variables[key] = val;
      } else {
        result.requiredVariables.push(key);
      }
      if (val.type === "secureString" || val.type === "secureObject") {
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
      scope.variables[key] = {
        type: val.type ?? "string",
      };
    }
    if (val.type === "secureString" || val.type === "securestring" || val.type === "secureObject") {
      scope.secretVariables.push(key);
    }
  }
};
