import { HttpMethods } from "@azure/core-http";
import { JsonLoader } from "../swagger/jsonLoader";
import { setDefaultOpts } from "../swagger/loader";
import { getLazyBuilder } from "../util/lazyBuilder";
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
  loadMode?: boolean;
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

export interface StepEnv {
  env: VariableEnv;
  scope: ScenarioDefinition["scope"];
  armDeployments: ArmDeploymentTracking[];
}

export interface ApiScenarioClientRequest {
  method: HttpMethods;
  path: string;
  headers: { [headerName: string]: string };
  query: { [headerName: string]: string };
  body?: any;
}

export interface ApiScenarioRunnerClient {
  createResourceGroup(
    subscriptionId: string,
    resourceGroupName: string,
    location: string
  ): Promise<void>;

  deleteResourceGroup(subscriptionId: string, resourceGroupName: string): Promise<void>;

  sendExampleRequest(
    request: ApiScenarioClientRequest,
    step: StepRestCall,
    stepEnv: StepEnv
  ): Promise<void>;

  sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    armDeployment: ArmDeploymentTracking,
    step: StepArmTemplate,
    stepEnv: StepEnv
  ): Promise<void>;
}

const numbers = "0123456789";
const lowerCases = "abcedfghijklmnopqrskuvwxyz";
const upperCases = "ABCEDFGHIJKLMNOPQRSKUVWXYZ";
export const getRandomString = (
  config: {
    length?: number;
    lowerCase?: boolean;
    upperCase?: boolean;
    number?: boolean;
  } = {}
) => {
  setDefaultOpts(config, {
    length: 6,
    lowerCase: true,
    upperCase: false,
    number: false,
  });

  const allowedChars = `${config.number ? numbers : ""}${config.lowerCase ? lowerCases : ""}${
    config.upperCase ? upperCases : ""
  }`;
  let result = "";
  for (let idx = 0; idx < config.length!; idx++) {
    result = result + allowedChars[Math.floor(Math.random() * allowedChars.length)];
  }
  return result;
};

export class ApiScenarioRunner {
  private jsonLoader: JsonLoader;
  private client: ApiScenarioRunnerClient;
  private env: VariableEnv;
  private scopeTracking: { [scopeName: string]: ScopeTracking };
  private scenarioScopeTracking: Map<Scenario, ScopeTracking> = new Map();
  private loadMode: boolean;

  private resourceTracking: { [resourceName: string]: VariableEnv };

  private provisionScope = getLazyBuilder("provisioned", async (scope: ScopeTracking) => {
    if (scope.scope !== "ResourceGroup") {
      throw new Error(`Scope is not supported yet: ${scope.scope}`);
    }

    const subscriptionId = scope.env.getRequired("subscriptionId");
    const location = scope.env.getRequired("location");
    const resourceGroupPrefix = scope.env.get("resourceGroupPrefix") ?? "apiTest-";
    const resourceGroupName =
      scope.env.get("resourceGroupName") ??
      resourceGroupPrefix +
        getRandomString({ length: 6, lowerCase: true, upperCase: false, number: false });
    scope.env.setBatch({ resourceGroupName });

    await this.client.createResourceGroup(subscriptionId, resourceGroupName, location);

    for (const step of scope.prepareSteps) {
      await this.executeStep(step, scope.env, scope);
    }

    return true;
  });

  public constructor(opts: ApiScenarioRunnerOption) {
    this.env = opts.env;
    this.client = opts.client;
    this.jsonLoader = opts.jsonLoader;
    this.loadMode = opts.loadMode ?? false;
    this.scopeTracking = {};
    this.resourceTracking = {};
  }

  public async prepareScope(scenario: Scenario): Promise<ScopeTracking> {
    let scope = this.scenarioScopeTracking.get(scenario);
    if (scope === undefined) {
      const testScopeName = scenario.shareScope
        ? "_defaultScope"
        : `_randomScope_${getRandomString()}`;

      scope = this.scopeTracking[testScopeName];
      if (scope === undefined) {
        const scenarioDef = scenario._scenarioDef;
        const env = new VariableEnv("scope", this.env);
        env.setBatch(scenarioDef.variables);
        scope = {
          scope: scenarioDef.scope,
          prepareSteps: scenarioDef.prepareSteps,
          cleanUpSteps: scenarioDef.cleanUpSteps,
          env,
          armDeployments: [],
        };
        this.scopeTracking[testScopeName] = scope;
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
    const env = new VariableEnv("scenario", scope.env);
    env.setBatch(scenario.variables);

    for (const step of scenario.steps) {
      await this.executeStep(step, env, scope);
    }
  }

  public async executeStep(step: Step, env: VariableEnv, scope: ScopeTracking) {
    const stepEnv = new VariableEnv("step", env);
    stepEnv.setBatch(step.variables);

    try {
      switch (step.type) {
        case "restCall":
          await this.executeRestCallStep(step, stepEnv, scope);
          break;
        case "armTemplateDeployment":
          await this.executeArmTemplateStep(step, stepEnv, scope);
          break;
      }
    } catch (error) {
      throw new Error(`Failed to execute step ${step.step}: ${(error as any).message}`);
    }
  }

  public async cleanAllScope() {
    for (const scope of Object.values(this.scopeTracking)) {
      for (const step of scope.cleanUpSteps) {
        await this.executeStep(step, scope.env, scope);
      }
      const subscriptionId = scope.env.getRequired("subscriptionId");
      const resourceGroupName = scope.env.getRequired("resourceGroupName");
      await this.client.deleteResourceGroup(subscriptionId, resourceGroupName);
    }
  }

  private async executeRestCallStep(step: StepRestCall, env: VariableEnv, scope: ScopeTracking) {
    const localEnv = new VariableEnv("local", env);
    if (step.resourceName !== undefined && this.resourceTracking[step.resourceName] === undefined) {
      this.resourceTracking[step.resourceName] = localEnv;
    }

    let req: ApiScenarioClientRequest = {
      method: step.operation._method.toUpperCase() as HttpMethods,
      path: "",
      headers: {},
      query: {},
    };

    for (const p of step.operation.parameters ?? []) {
      const param = this.jsonLoader.resolveRefObj(p);
      let paramValue = step.requestParameters[param.name];
      if (paramValue === `$(${param.name})`) {
        paramValue = env.get(param.name);
      }
      if (paramValue === undefined && param.required) {
        throw new Error(
          `Parameter value for "${param.name}" is not found in example: ${step.exampleFilePath}`
        );
      }

      switch (param.in) {
        case "path":
          if (this.loadMode || step.resourceName === undefined) {
            localEnv.set(param.name, paramValue);
          } else {
            if (localEnv === this.resourceTracking[step.resourceName]) {
              // Save resource path parameters
              localEnv.set(param.name, localEnv.get(param.name) ?? paramValue);
            } else {
              // Reuse resource path parameters
              localEnv.set(
                param.name,
                this.resourceTracking[step.resourceName].getRequired(param.name)
              );
            }
          }
          break;
        case "query":
          req.query[param.name] = paramValue;
          break;
        case "header":
          req.headers[param.name] = paramValue;
          break;
        case "body":
          req.body = paramValue;
          break;
        default:
          throw new Error(`Parameter "in" not supported: ${param.in}`);
      }
    }
    const pathTemplate = step.operation._path._pathTemplate;

    req.path = localEnv.resolveString(pathTemplate, true);
    req = localEnv.resolveObjectValues(req);

    await this.client.sendExampleRequest(req, step, {
      env: this.loadMode ? env : localEnv,
      scope: scope.scope,
      armDeployments: scope.armDeployments,
    });
  }

  private async executeArmTemplateStep(
    step: StepArmTemplate,
    env: VariableEnv,
    scope: ScopeTracking
  ) {
    step.armTemplatePayload = env.resolveObjectValues(step.armTemplatePayload);

    const subscriptionId = env.getRequired("subscriptionId");
    const resourceGroupName = env.getRequired("resourceGroupName");

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

    await this.client.sendArmTemplateDeployment(step.armTemplatePayload, armDeployment, step, {
      env,
      scope: scope.scope,
      armDeployments: scope.armDeployments,
    });
  }
}
