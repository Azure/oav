/* eslint-disable require-atomic-updates */

import { basename } from "path";
import { cloneDeep, pathDirName, pathJoin } from "@azure-tools/openapi-tools-common";
import { inject, injectable } from "inversify";
import { apply as jsonMergeApply, generate as jsonMergePatchGenerate } from "json-merge-patch";
import { findReadMe } from "@azure/openapi-markdown";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import { FileLoader, FileLoaderOption } from "../swagger/fileLoader";
import { JsonLoader, JsonLoaderOption } from "../swagger/jsonLoader";
import { Loader, setDefaultOpts } from "../swagger/loader";
import { SwaggerLoader, SwaggerLoaderOption } from "../swagger/swaggerLoader";
import {
  ApiKeySecurity,
  BodyParameter,
  Operation,
  Parameter,
  SwaggerExample,
  SwaggerSpec,
} from "../swagger/swaggerTypes";
import { SchemaValidator } from "../swaggerValidator/schemaValidator";
import { allOfTransformer } from "../transform/allOfTransformer";
import { getTransformContext, TransformContext } from "../transform/context";
import { discriminatorTransformer } from "../transform/discriminatorTransformer";
import { noAdditionalPropertiesTransformer } from "../transform/noAdditionalPropertiesTransformer";
import { nullableTransformer } from "../transform/nullableTransformer";
import { pureObjectTransformer } from "../transform/pureObjectTransformer";
import { referenceFieldsTransformer } from "../transform/referenceFieldsTransformer";
import { resolveNestedDefinitionTransformer } from "../transform/resolveNestedDefinitionTransformer";
import { applyGlobalTransformers, applySpecTransformers } from "../transform/transformer";
import { traverseSwagger } from "../transform/traverseSwagger";
import { xmsPathsTransformer } from "../transform/xmsPathsTransformer";
import { getInputFiles } from "../util/utils";
import { xmsExamples } from "../util/constants";
import { logger } from "./logger";
import {
  ArmDeploymentScriptResource,
  ArmTemplate,
  Authentication,
  RawAuthentication,
  RawScenario,
  RawScenarioDefinition,
  RawStep,
  RawStepArmScript,
  RawStepArmTemplate,
  RawStepExample,
  RawStepOperation,
  RawStepRoleAssignment,
  RawVariableScope,
  ReadmeTag,
  Scenario,
  ScenarioDefinition,
  Step,
  StepArmTemplate,
  StepRestCall,
  StepRoleAssignment,
  Variable,
  VariableScope,
} from "./apiScenarioTypes";
import { ApiScenarioYamlLoader } from "./apiScenarioYamlLoader";
import { BodyTransformer } from "./bodyTransformer";
import { armDeploymentScriptTemplate, DEFAULT_ARM_ENDPOINT } from "./constants";
import { jsonPatchApply } from "./diffUtils";
import { TemplateGenerator } from "./templateGenerator";

const variableRegex = /\$\(([A-Za-z_$][A-Za-z0-9_]*)\)/;

export interface ApiScenarioLoaderOption
  extends FileLoaderOption,
    JsonLoaderOption,
    SwaggerLoaderOption {
  includeOperation?: boolean;
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
  private additionalMap = new Map<
    string,
    {
      operationsMap: Map<string, Operation>;
      apiVersionsMap: Map<string, string>;
    }
  >();
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
    setDefaultOpts(opts, {
      skipResolveRefKeys: [xmsExamples],
      includeOperation: true,
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
  }

  public static create(opts: ApiScenarioLoaderOption) {
    return inversifyGetInstance(ApiScenarioLoader, opts);
  }

  private async initialize(swaggerFilePaths: string[], additionalTags?: ReadmeTag[]) {
    if (this.initialized) {
      throw new Error("Already initialized");
    }

    await this.loadSwaggers(
      swaggerFilePaths,
      this.operationsMap,
      this.apiVersionsMap,
      this.exampleToOperation
    );

    if (additionalTags) {
      for (const e of additionalTags) {
        logger.verbose(`Additional readme tag: ${e.filePath}`);

        const inputFiles = await getInputFiles(e.filePath, e.tag);
        if (inputFiles) {
          this.additionalMap.set(e.name, {
            operationsMap: new Map<string, Operation>(),
            apiVersionsMap: new Map<string, string>(),
          });

          const additionalSwaggerFiles: string[] = [];
          inputFiles.forEach((f) => {
            additionalSwaggerFiles.push(pathJoin(pathDirName(e.filePath), f));
          });

          logger.verbose("Additional input-file:");
          logger.verbose(additionalSwaggerFiles);

          await this.loadSwaggers(
            additionalSwaggerFiles,
            this.additionalMap.get(e.name)!.operationsMap,
            this.additionalMap.get(e.name)!.apiVersionsMap
          );
        }
      }
    }

    this.initialized = true;
  }

  private async loadSwaggers(
    swaggerFilePaths: string[],
    opsMap: Map<string, Operation>,
    verMap: Map<string, string>,
    egOpMap?: Map<string, { [operationId: string]: string }>
  ) {
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

          if (opsMap.has(operation.operationId)) {
            throw new Error(
              `Duplicated operationId ${operation.operationId}: ${
                operation._path._pathTemplate
              }\nConflict with path: ${opsMap.get(operation.operationId)?._path._pathTemplate}`
            );
          }
          opsMap.set(operation.operationId, operation);
          verMap.set(operation.operationId, spec.info.version);

          if (egOpMap) {
            const xMsExamples = operation[xmsExamples] ?? {};
            for (const exampleName of Object.keys(xMsExamples)) {
              const example = xMsExamples[exampleName];
              if (typeof example.$ref !== "string") {
                throw new Error(`Example doesn't use $ref: ${exampleName}`);
              }
              const exampleFilePath = this.fileLoader.relativePath(
                this.jsonLoader.getRealPath(example.$ref)
              );
              let opMap = egOpMap.get(exampleFilePath);
              if (opMap === undefined) {
                opMap = {};
                egOpMap.set(exampleFilePath, opMap);
              }
              opMap[operation.operationId] = exampleName;
            }
          }
        },
      });
    }
  }

  public async load(
    scenarioFilePath: string,
    swaggerFilePaths?: string[],
    readmePath?: string
  ): Promise<ScenarioDefinition> {
    const [rawDef, additionalTags] = await this.apiScenarioYamlLoader.load(scenarioFilePath);

    if (!swaggerFilePaths || swaggerFilePaths.length === 0) {
      swaggerFilePaths = [];
      if (!readmePath) {
        readmePath = await findReadMe(pathDirName(scenarioFilePath));
      }
      if (readmePath) {
        const inputFile = await getInputFiles(readmePath);
        for (const it of inputFile ?? []) {
          if (swaggerFilePaths.indexOf(it) < 0) {
            swaggerFilePaths.push(this.fileLoader.resolvePath(it));
          }
        }
      }
    }

    await this.initialize(swaggerFilePaths, additionalTags);

    rawDef.scope = rawDef.scope ?? "ResourceGroup";
    const isArmScope = rawDef.scope !== "None";

    const scenarioDef: ScenarioDefinition = {
      name: basename(scenarioFilePath).substring(0, basename(scenarioFilePath).lastIndexOf(".")),
      scope: rawDef.scope,
      prepareSteps: [],
      scenarios: [],
      _filePath: this.fileLoader.relativePath(scenarioFilePath),
      _swaggerFilePaths: swaggerFilePaths!,
      cleanUpSteps: [],
      ...convertVariables(rawDef.variables),
      authentication: this.loadAuthentication(rawDef.authentication),
    };

    if (isArmScope) {
      if (!scenarioDef.authentication) {
        scenarioDef.authentication = {
          type: "AADToken",
          scope: "$(armEndpoint)/.default",
        };
      }
      if (!scenarioDef.variables.armEndpoint) {
        scenarioDef.variables.armEndpoint = {
          type: "string",
          value: DEFAULT_ARM_ENDPOINT,
        };
      }
      const requiredVariables = new Set(scenarioDef.requiredVariables);
      if (["ResourceGroup", "Subscription"].indexOf(scenarioDef.scope) >= 0) {
        requiredVariables.add("subscriptionId");
        if (scenarioDef.scope === "ResourceGroup") {
          requiredVariables.add("location");
        }
      }
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
      ctx.stepTracking.clear();
      const scenario = await this.loadScenario(rawScenario, ctx);
      scenarioDef.scenarios.push(scenario);
      ctx.scenarioIndex++;
    }

    // await this.writeTestDefinitionFile("./test.yaml", scenarioDef);

    return scenarioDef;
  }

  private loadAuthentication(
    rawAuthentication: RawAuthentication | undefined
  ): Authentication | undefined {
    const authentication = rawAuthentication as Authentication | undefined;
    switch (authentication?.type) {
      case "AADToken":
        authentication.scope = authentication.scope ?? "$(armEndpoint)/.default";
        break;
      case "AzureKey":
        authentication.name = authentication.name ?? "Authorization";
        authentication.in = authentication.in ?? "header";
        break;
      case "None":
      default:
        break;
    }
    return authentication;
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
    const steps: Step[] = [];
    const { scenarioDef } = ctx;

    const variableScope = convertVariables(rawScenario.variables);
    variableScope.requiredVariables = [
      ...new Set([...scenarioDef.requiredVariables, ...variableScope.requiredVariables]),
    ];

    const scenario: Scenario = {
      scenario: rawScenario.scenario ?? `scenario_${ctx.scenarioIndex}`,
      description: rawScenario.description ?? "",
      steps,
      _scenarioDef: scenarioDef,
      ...variableScope,
      authentication:
        this.loadAuthentication(rawScenario.authentication) ?? scenarioDef.authentication,
    };

    ctx.scenario = scenario;
    ctx.stepIndex = 0;

    for (const rawStep of rawScenario.steps) {
      const step = await this.loadStep(rawStep, ctx);
      steps.push(step);
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
      } else if ("roleAssignment" in rawStep) {
        step = await this.loadStepRoleAssignment(rawStep, ctx);
      } else {
        throw new Error("Invalid step");
      }
    } catch (error) {
      throw new Error(`Failed to load step ${JSON.stringify(rawStep)}: ${(error as any).message}`);
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

  private getVariableFunction(step: Step, ctx: ApiScenarioContext) {
    return (name: string) => {
      const variable =
        step.variables[name] ?? ctx.scenario?.variables[name] ?? ctx.scenarioDef.variables[name];
      return variable;
    };
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
      step: rawStep.step ?? `_${ctx.stepIndex}`,
      description: rawStep.description,
      operationId: "",
      operation: {} as Operation,
      parameters: {} as SwaggerExample["parameters"],
      responses: {} as SwaggerExample["responses"],
      outputVariables: rawStep.outputVariables ?? {},
      ...convertVariables(rawStep.variables),
      authentication:
        this.loadAuthentication(rawStep.authentication) ??
        ctx.scenario?.authentication ??
        ctx.scenarioDef.authentication,
    };

    const getVariable = (
      name: string,
      ...scopes: Array<VariableScope | undefined>
    ): Variable | undefined => {
      if (!scopes || scopes.length === 0) {
        scopes = [step, ctx.scenario, ctx.scenarioDef];
      }
      for (const scope of scopes) {
        if (scope && scope.variables[name]) {
          return scope.variables[name];
        }
      }
      for (const scope of scopes) {
        if (scope && scope.requiredVariables.includes(name)) {
          return {
            type: "string",
            value: `$(${name})`,
          };
        }
      }
      if (
        (ctx.scenarioDef.scope === "ResourceGroup" &&
          ["subscriptionId", "resourceGroupName", "location"].includes(name)) ||
        (ctx.scenarioDef.scope === "Subscription" && ["subscriptionId"].includes(name))
      ) {
        return {
          type: "string",
          value: `$(${name})`,
        };
      }
      return undefined;
    };

    const requireVariable = (name: string) => {
      if (ctx.scenarioDef.scope === "ResourceGroup" && ["resourceGroupName"].includes(name)) {
        return;
      }
      const requiredVariables =
        ctx.scenario?.requiredVariables ?? ctx.scenarioDef.requiredVariables;
      if (!requiredVariables.includes(name)) {
        requiredVariables.push(`${name}`);
      }
    };

    let operation: Operation | undefined;

    if (!("exampleFile" in rawStep)) {
      // load operation step
      step.operationId = rawStep.operationId;

      operation = rawStep.readmeTag
        ? this.additionalMap.get(rawStep.readmeTag)?.operationsMap.get(step.operationId)
        : this.operationsMap.get(step.operationId);
      if (operation === undefined) {
        throw new Error(`Operation not found for ${step.operationId} in step ${step.step}`);
      }
      if (rawStep.readmeTag) {
        step.externalReference = true;
      }
      step.isManagementPlane = this.isManagementPlane(operation);
      if (this.opts.includeOperation) {
        step.operation = operation;
      }

      if (rawStep.variables) {
        for (const [name, value] of Object.entries(rawStep.variables)) {
          if (typeof value === "string") {
            step.variables[name] = { type: "string", value };
            continue;
          }

          if (value.type === "object" || value.type === "secureObject" || value.type === "array") {
            if (value.patches) {
              const variable = ctx.scenario
                ? getVariable(name, ctx.scenario, ctx.scenarioDef)
                : getVariable(name, ctx.scenarioDef);
              if (!variable) {
                throw new Error(`Variable ${name} not found in step ${step.step}`);
              }
              const obj = cloneDeep(variable);
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

      operation.parameters?.forEach((param) => {
        param = this.jsonLoader.resolveRefObj(param);
        if (param.name === "api-version") {
          step.parameters["api-version"] = rawStep.readmeTag
            ? this.additionalMap.get(rawStep.readmeTag)?.apiVersionsMap.get(step.operationId)!
            : this.apiVersionsMap.get(step.operationId)!;
        } else if (rawStep.parameters?.[param.name]) {
          step.parameters[param.name] = rawStep.parameters[param.name];
        } else {
          const v = getVariable(param.name);
          if (v) {
            if (param.in === "body") {
              step.parameters[param.name] = v.value;
            } else {
              step.parameters[param.name] = `$(${param.name})`;
            }
          } else if (param.in === "path" || param.required) {
            step.parameters[param.name] = `$(${param.name})`;
            requireVariable(param.name);
          }
        }
      });

      const xHost = operation._path._spec["x-ms-parameterized-host"];
      if (xHost) {
        xHost.parameters.forEach((param) => {
          param = this.jsonLoader.resolveRefObj(param);
          if (rawStep.parameters?.[param.name]) {
            step.variables[param.name] = {
              type: "string",
              value: rawStep.parameters[param.name] as string,
            };
          }
        });
      }

      step.responseAssertion = rawStep.responses;
    } else {
      // load example step
      step.exampleFile = rawStep.exampleFile;

      const exampleFilePath = pathJoin(pathDirName(ctx.scenarioDef._filePath), step.exampleFile!);

      // Load example file
      const fileContent = await this.fileLoader.load(exampleFilePath);
      const exampleFileContent = JSON.parse(fileContent) as SwaggerExample;

      // Load Operation
      if (rawStep.operationId || exampleFileContent.operationId) {
        step.operationId = (rawStep.operationId ?? exampleFileContent.operationId)!;

        operation = this.operationsMap.get(step.operationId);
        if (operation === undefined) {
          throw new Error(`Operation not found for ${step.operationId} in step ${step.step}`);
        }
        step.isManagementPlane = this.isManagementPlane(operation);
        if (this.opts.includeOperation) {
          step.operation = operation;
        }
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
        operation = this.operationsMap.get(step.operationId);
        if (operation === undefined) {
          throw new Error(`Operation not found for ${step.operationId} in step ${step.step}`);
        }
        step.isManagementPlane = this.isManagementPlane(operation);
        if (this.opts.includeOperation) {
          step.operation = operation;
        }
        step.description = step.description ?? exampleName;
      }

      step.parameters = exampleFileContent.parameters;

      // force update api-version
      if (step.parameters["api-version"]) {
        step.parameters["api-version"] = this.apiVersionsMap.get(step.operationId)!;
      }

      step.responses = exampleFileContent.responses;

      await this.applyPatches(step, rawStep, operation);

      this.templateGenerator.exampleParameterConvention(step, getVariable, operation);
    }

    const security = operation?.security || operation?._path._spec.security;
    if (!step.authentication && security) {
      if (security.length > 1) {
        logger.warn("Multiple security definitions found, only the first one will be used");
      }
      const security0 = security[0];
      const key = Object.keys(security0)[0];
      const securityDefinition = operation?._path._spec.securityDefinitions?.[key];
      if (!securityDefinition) {
        throw new Error(`Security definition not found for ${key}`);
      }
      if (securityDefinition.type === "oauth2") {
        const value = security0[key];
        if (value.length > 1) {
          throw new Error(`Multiple scopes are not supported yet: ${JSON.stringify(value)}`);
        }
        const scope = value[0];
        step.authentication = {
          type: "AADToken",
          scope: scope,
        };
      } else if (securityDefinition.type === "apiKey") {
        const def = securityDefinition as ApiKeySecurity;
        step.authentication = {
          type: "AzureKey",
          key: `$(${key})`,
          in: def.in === "query" ? "query" : "header",
          name: def.name ?? "Authorization",
        };
      }
    }

    if (!rawStep.step) {
      step.step = step.operationId;
      let i = 1;
      while (ctx.stepTracking.has(step.step)) {
        step.step += `_${i++}`;
      }
    }
    ctx.stepTracking.set(step.step, step);

    return step;
  }

  private isManagementPlane(operation: Operation): boolean {
    const spec = operation._path._spec;
    if (spec.host === "management.azure.com") {
      return true;
    }
    if (spec._filePath.indexOf("/resource-manager/") >= 0) {
      return true;
    }
    return false;
  }

  private async applyPatches(step: StepRestCall, rawStep: RawStepExample, operation: Operation) {
    if (rawStep.requestUpdate) {
      const bodyParam = getBodyParam(operation, this.jsonLoader);
      let source;
      if (bodyParam) {
        source = cloneDeep(step.parameters[bodyParam.name]);
      }
      jsonPatchApply(step.parameters, rawStep.requestUpdate);
      if (["put", "patch"].includes(operation._method) && bodyParam) {
        const target = step.parameters[bodyParam.name];
        const propertiesMergePatch = jsonMergePatchGenerate(source, target);

        Object.keys(step.responses).forEach(async (statusCode) => {
          if (statusCode >= "400") {
            return;
          }
          const response = step.responses[statusCode];
          if (response.body) {
            jsonMergeApply(response.body, propertiesMergePatch);
            await this.bodyTransformer.resourceToResponse(
              response.body,
              operation.responses[statusCode].schema!
            );
          }
        });
      }
    }
    if (rawStep.responseUpdate) {
      jsonPatchApply(step.responses, rawStep.responseUpdate);
    }
  }

  private async loadStepArmDeploymentScript(
    rawStep: RawStepArmScript,
    ctx: ApiScenarioContext
  ): Promise<StepArmTemplate> {
    const step: StepArmTemplate = {
      type: "armTemplateDeployment",
      step: rawStep.step ?? `ArmDeploymentScript_${ctx.stepIndex}`,
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

    const filePath = pathJoin(pathDirName(scenarioDef._filePath), rawStep.armDeploymentScript);
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

    this.templateGenerator.armTemplateParameterConvention(
      step,
      this.getVariableFunction(step, ctx)
    );

    return step;
  }

  private async loadStepRoleAssignment(
    rawStep: RawStepRoleAssignment,
    ctx: ApiScenarioContext
  ): Promise<StepRoleAssignment> {
    const step: StepRoleAssignment = {
      type: "armRoleAssignment",
      step: rawStep.step ?? `RoleAssignment_${ctx.stepIndex}`,
      outputVariables: rawStep.outputVariables ?? {},
      roleAssignment: rawStep.roleAssignment,
      ...convertVariables(rawStep.variables),
      authentication: ctx.scenario?.authentication ?? ctx.scenarioDef.authentication,
    };
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

    const filePath = pathJoin(pathDirName(scenarioDef._filePath), step.armTemplate);
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

    this.templateGenerator.armTemplateParameterConvention(
      step,
      this.getVariableFunction(step, ctx)
    );

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
      result.variables[key] = val;
      if (val.value === undefined) {
        if (val.type === "string" || val.type === "secureString") {
          if (val.value === undefined && val.prefix === undefined) {
            result.requiredVariables.push(key);
          }
        } else if (
          (val.type === "object" || val.type === "secureObject" || val.type === "array") &&
          val.patches !== undefined
        ) {
          // ok
        } else {
          throw new Error(
            `Only string and secureString type is supported in environment variables, please specify value for: ${key}`
          );
        }
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
