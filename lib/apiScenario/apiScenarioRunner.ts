import { HttpMethods } from "@azure/core-http";
import { JsonLoader } from "../swagger/jsonLoader";
import { getLazyBuilder } from "../util/lazyBuilder";
import { getRandomString } from "../util/utils";
import {
  ArmTemplate,
  ScenarioDefinition,
  Scenario,
  Step,
  StepArmTemplate,
  StepRestCall,
} from "./apiScenarioTypes";
import { VariableEnv } from "./variableEnv";

export interface ApiScenarioRunnerOption {
  env: VariableEnv;
  client: ApiScenarioRunnerClient;
  jsonLoader: JsonLoader;
  resolveVariables?: boolean;
}

export interface ArmDeploymentTracking {
  deploymentName: string;
  step: StepArmTemplate;
  details: {
    scope: "ResourceGroup";
    subscriptionId: string;
    resourceGroupName: string;
  };
}

interface ScopeTracking {
  provisioned?: boolean;
  scope: ScenarioDefinition["scope"];
  prepareSteps: Step[];
  cleanUpSteps: Step[];
  env: VariableEnv;
  armDeployments: ArmDeploymentTracking[];
}

export interface ApiScenarioClientRequest {
  method: HttpMethods;
  path: string;
  pathVariables?: { [variableName: string]: string };
  headers: { [headerName: string]: string };
  query: { [key: string]: string };
  body?: any;
}

export interface ApiScenarioRunnerClient {
  createResourceGroup(
    subscriptionId: string,
    resourceGroupName: string,
    location: string
  ): Promise<void>;

  deleteResourceGroup(subscriptionId: string, resourceGroupName: string): Promise<void>;

  sendRestCallRequest(
    request: ApiScenarioClientRequest,
    step: StepRestCall,
    env: VariableEnv
  ): Promise<void>;

  sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    armDeployment: ArmDeploymentTracking,
    step: StepArmTemplate,
    env: VariableEnv
  ): Promise<void>;
}

export class ApiScenarioRunner {
  private jsonLoader: JsonLoader;
  private client: ApiScenarioRunnerClient;
  private env: VariableEnv;
  private scopeTracking: { [scopeName: string]: ScopeTracking };
  private scenarioScopeTracking: Map<Scenario, ScopeTracking>;
  private resolveVariables: boolean;

  private provisionScope = getLazyBuilder("provisioned", async (scope: ScopeTracking) => {
    if (scope.scope !== "ResourceGroup") {
      throw new Error(`Scope is not supported yet: ${scope.scope}`);
    }

    if (scope.env.get("resourceGroupName") === undefined) {
      const resourceGroupPrefix = scope.env.getString("resourceGroupPrefix") ?? "apiTest-";
      scope.env.set("resourceGroupName", {
        type: "string",
        value: resourceGroupPrefix + getRandomString(),
      });
    }

    await this.client.createResourceGroup(
      scope.env.getRequiredString("subscriptionId"),
      scope.env.getRequiredString("resourceGroupName"),
      scope.env.getRequiredString("location")
    );

    for (const step of scope.prepareSteps) {
      await this.executeStep(step, scope.env, scope);
    }

    return true;
  });

  public constructor(opts: ApiScenarioRunnerOption) {
    this.env = opts.env;
    this.client = opts.client;
    this.jsonLoader = opts.jsonLoader;
    this.resolveVariables = opts.resolveVariables ?? true;
    this.scopeTracking = {};
    this.scenarioScopeTracking = new Map();
  }

  public async prepareScope(scenario: Scenario): Promise<ScopeTracking> {
    let scope = this.scenarioScopeTracking.get(scenario);
    if (scope === undefined) {
      const scopeName = scenario.shareScope ? "_defaultScope" : `_randomScope_${getRandomString()}`;

      scope = this.scopeTracking[scopeName];
      if (scope === undefined) {
        const scenarioDef = scenario._scenarioDef;
        const env = new VariableEnv(this.env);
        env.setBatch(scenarioDef.variables);
        scope = {
          scope: scenarioDef.scope,
          prepareSteps: scenarioDef.prepareSteps,
          cleanUpSteps: scenarioDef.cleanUpSteps,
          env,
          armDeployments: [],
        };
        this.scopeTracking[scopeName] = scope;
      }

      this.scenarioScopeTracking.set(scenario, scope);
    }

    await this.provisionScope(scope);
    return scope;
  }

  public scopePreparedExternal(
    scopeInput: Pick<ScopeTracking, "env" | "armDeployments" | "provisioned">,
    info: {
      scenario?: Scenario;
      scopeName?: string;
      scenarioDef?: ScenarioDefinition;
    }
  ): void {
    const { scenario, scopeName } = info;
    const scenarioDef = scenario?._scenarioDef ?? info.scenarioDef;

    if (scenarioDef === undefined) {
      throw new Error("Either Scenario or ScenarioDef must be provided.");
    }

    const scope = {
      scope: scenarioDef.scope,
      prepareSteps: scenarioDef.prepareSteps,
      cleanUpSteps: scenarioDef.cleanUpSteps,
      ...scopeInput,
    };
    if (scopeName !== undefined) {
      if (this.scopeTracking[scopeName] !== undefined) {
        throw new Error(`Scope already created: ${scopeName}`);
      }
      this.scopeTracking[scopeName] = scope;
    }

    if (scenario !== undefined) {
      if (this.scenarioScopeTracking.get(scenario) !== undefined) {
        throw new Error(
          `Scope already created for scenario: ${scenario.description} , scopeName: ${scopeName}`
        );
      }
      this.scenarioScopeTracking.set(scenario, scope);
    }
  }

  public async executeScenario(scenario: Scenario) {
    const scope = await this.prepareScope(scenario);
    const env = new VariableEnv(scope.env);
    env.setBatch(scenario.variables);

    for (const step of scenario.steps) {
      await this.executeStep(step, env, scope);
    }
  }

  public async executeStep(step: Step, env: VariableEnv, scope: ScopeTracking) {
    const stepEnv = new VariableEnv(env);
    stepEnv.setBatch(step.variables);
    // stepEnv.setDefault(step.defaultValues);

    if (this.resolveVariables) {
      stepEnv.resolve();
    }

    try {
      switch (step.type) {
        case "restCall":
          await this.executeRestCallStep(step, stepEnv);
          break;
        case "armTemplateDeployment":
          await this.executeArmTemplateStep(step, stepEnv, scope);
          break;
      }
    } catch (error) {
      throw new Error(
        `Failed to execute step ${step.step}: ${(error as any).message} \n${error.stack}`
      );
    }
  }

  public async cleanAllScope() {
    for (const scope of Object.values(this.scopeTracking)) {
      for (const step of scope.cleanUpSteps) {
        await this.executeStep(step, scope.env, scope);
      }
      const subscriptionId = scope.env.getRequiredString("subscriptionId");
      const resourceGroupName = scope.env.getRequiredString("resourceGroupName");
      await this.client.deleteResourceGroup(subscriptionId, resourceGroupName);
    }
  }

  private async executeRestCallStep(step: StepRestCall, env: VariableEnv) {
    let req: ApiScenarioClientRequest = {
      method: step.operation._method.toUpperCase() as HttpMethods,
      path: step.operation._path._pathTemplate.replace(/{([a-z0-9_]+)}/gi, (_, p1) => `$(${p1})`),
      pathVariables: {},
      headers: {},
      query: {},
    };

    for (const p of step.operation.parameters ?? []) {
      const param = this.jsonLoader.resolveRefObj(p);

      const paramVal = step.parameters[param.name];
      if (paramVal === undefined && env.get(param.name) === undefined) {
        if (param.required) {
          throw new Error(`Parameter value for "${param.name}" is not found in step: ${step.step}`);
        } else {
          continue;
        }
      }

      switch (param.in) {
        case "path":
          req.pathVariables![param.name] = paramVal;
          break;
        case "query":
          req.query[param.name] = paramVal;
          break;
        case "header":
          req.headers[param.name] = paramVal;
          break;
        case "body":
          req.body = paramVal;
          break;
        default:
          throw new Error(`Parameter "in" not supported: ${param.in}`);
      }
    }

    if (this.resolveVariables) {
      req = env.resolveObjectValues(req);
    }

    await this.client.sendRestCallRequest(req, step, env);
  }

  private async executeArmTemplateStep(
    step: StepArmTemplate,
    env: VariableEnv,
    scope: ScopeTracking
  ) {
    const subscriptionId = env.getRequiredString("subscriptionId");
    const resourceGroupName = env.getRequiredString("resourceGroupName");

    const armDeployment: ArmDeploymentTracking = {
      deploymentName: `${resourceGroupName}-deploy-${getRandomString()}`,
      step,
      details: {
        scope: scope.scope,
        subscriptionId,
        resourceGroupName,
      },
    };
    scope.armDeployments.push(armDeployment);

    if (this.resolveVariables) {
      step.armTemplatePayload = env.resolveObjectValues(step.armTemplatePayload);
    }

    await this.client.sendArmTemplateDeployment(step.armTemplatePayload, armDeployment, step, env);
  }
}
