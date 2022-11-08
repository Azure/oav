import { HttpMethods } from "@azure/core-http";
import { JsonLoader } from "../swagger/jsonLoader";
import { xmsSkipUrlEncoding } from "../util/constants";
import { getRandomString } from "../util/utils";
import {
  ArmTemplate,
  ScenarioDefinition,
  Scenario,
  Step,
  StepArmTemplate,
  StepRestCall,
  StepRoleAssignment,
} from "./apiScenarioTypes";
import { AzureBuiltInRoles } from "./azureBuiltInRoles";
import { DEFAULT_ROLE_ASSIGNMENT_API_VERSION } from "./constants";
import { EnvironmentVariables, VariableEnv } from "./variableEnv";

export interface ApiScenarioRunnerOption {
  env: EnvironmentVariables;
  client: ApiScenarioRunnerClient;
  jsonLoader: JsonLoader;
}

export interface ArmDeployment {
  deploymentName: string;
  step: StepArmTemplate;
  details: {
    scope: string;
    subscriptionId: string;
    resourceGroupName: string;
  };
}

export interface Scope {
  provisioned?: boolean;
  type: ScenarioDefinition["scope"];
  prepareSteps: Step[];
  cleanUpSteps: Step[];
  env: VariableEnv;
}

export interface ApiScenarioClientRequest {
  host: string;
  method: HttpMethods;
  path: string;
  pathParameters?: { [paramName: string]: string };
  headers: { [headerName: string]: string };
  query: { [key: string]: string };
  body?: any;
}

export interface ApiScenarioRunnerClient {
  provisionScope(scenarioDef: ScenarioDefinition, scope: Scope): Promise<void>;

  prepareScenario(scenario: Scenario, env: VariableEnv): Promise<void>;

  createResourceGroup(
    armEndpoint: string,
    subscriptionId: string,
    resourceGroupName: string,
    location: string
  ): Promise<void>;

  deleteResourceGroup(
    armEndpoint: string,
    subscriptionId: string,
    resourceGroupName: string
  ): Promise<void>;

  sendRestCallRequest(
    request: ApiScenarioClientRequest,
    step: StepRestCall,
    env: VariableEnv
  ): Promise<void>;

  sendArmTemplateDeployment(
    armEndpoint: string,
    armTemplate: ArmTemplate,
    armDeployment: ArmDeployment,
    step: StepArmTemplate,
    env: VariableEnv
  ): Promise<void>;
}

export class ApiScenarioRunner {
  private jsonLoader: JsonLoader;
  private client: ApiScenarioRunnerClient;
  private env: EnvironmentVariables;
  private scope: Scope;

  public constructor(opts: ApiScenarioRunnerOption) {
    this.env = opts.env;
    this.client = opts.client;
    this.jsonLoader = opts.jsonLoader;
  }

  private async prepareScope(scenarioDef: ScenarioDefinition) {
    // Variable scope: ScenarioDef <= RuntimeScope <= Scenario <= Step
    const scopeEnv =
      // RuntimeScope
      new VariableEnv(
        // ScenarioDef
        new VariableEnv().setBatch(scenarioDef.variables)
      ).setBatchEnv(this.env);
    this.scope = {
      type: scenarioDef.scope,
      prepareSteps: scenarioDef.prepareSteps,
      cleanUpSteps: scenarioDef.cleanUpSteps,
      env: scopeEnv,
    };

    if (
      scenarioDef.scope === "ResourceGroup" &&
      this.scope.env.get("resourceGroupName") === undefined
    ) {
      this.scope.env.set("resourceGroupName", {
        type: "string",
        prefix: "apiTest-",
      });
    }

    this.generateValueFromPrefix(this.scope.env);

    await this.client.provisionScope(scenarioDef, this.scope);

    if (this.scope.type === "ResourceGroup") {
      await this.client.createResourceGroup(
        this.scope.env.getRequiredString("armEndpoint"),
        this.scope.env.getRequiredString("subscriptionId"),
        this.scope.env.getRequiredString("resourceGroupName"),
        this.scope.env.getRequiredString("location")
      );
    }
    for (const step of this.scope.prepareSteps) {
      await this.executeStep(step, this.scope.env, this.scope);
    }
  }

  private async cleanUpScope(): Promise<void> {
    for (const step of this.scope.cleanUpSteps) {
      await this.executeStep(step, this.scope.env, this.scope);
    }
    if (this.scope.type === "ResourceGroup") {
      await this.client.deleteResourceGroup(
        this.scope.env.getRequiredString("armEndpoint"),
        this.scope.env.getRequiredString("subscriptionId"),
        this.scope.env.getRequiredString("resourceGroupName")
      );
    }
  }

  private generateValueFromPrefix(env: VariableEnv) {
    for (const [_, v] of env.getVariables()) {
      if (v.type === "string" || v.type === "secureString") {
        if (v.prefix !== undefined && v.value === undefined) {
          v.value = v.prefix + getRandomString();
        }
      }
    }
  }

  public async execute(scenarioDef: ScenarioDefinition) {
    if (this.scope === undefined) {
      await this.prepareScope(scenarioDef);
    }

    for (const scenario of scenarioDef.scenarios) {
      try {
        const scenarioEnv = new VariableEnv(this.scope.env).setBatch(scenario.variables);

        this.generateValueFromPrefix(scenarioEnv);

        await this.client.prepareScenario(scenario, scenarioEnv);

        for (const step of scenario.steps) {
          await this.executeStep(step, scenarioEnv, this.scope);
        }
      } catch (e) {
        throw new Error(
          `Failed to execute scenario: ${scenario.scenario}: ${e.message} \n${e.stack}`
        );
      }
    }

    await this.cleanUpScope();
  }

  private async executeStep(step: Step, env: VariableEnv, scope: Scope) {
    const stepEnv = new VariableEnv(env).setBatch(step.variables);

    this.generateValueFromPrefix(stepEnv);

    try {
      switch (step.type) {
        case "restCall":
          await this.executeRestCallStep(step, stepEnv);
          break;
        case "armTemplateDeployment":
          await this.executeArmTemplateStep(step, stepEnv, scope);
          break;
        case "armRoleAssignment":
          await this.executeArmRoleAssignmentStep(step, stepEnv);
          break;
      }
    } catch (e) {
      throw new Error(`Failed to execute step ${step.step}: ${e.message} \n${e.stack}`);
    }
  }

  private async executeArmRoleAssignmentStep(step: StepRoleAssignment, env: VariableEnv) {
    const parameters = {
      scope: step.roleAssignment.scope,
      roleAssignmentName: "{{$guid}}",
      "api-version": DEFAULT_ROLE_ASSIGNMENT_API_VERSION,
    };

    const roleDefinitionId =
      step.roleAssignment.roleDefinitionId ??
      AzureBuiltInRoles.find((r) => r.roleName === step.roleAssignment.roleName)?.roleDefinitionId;

    if (roleDefinitionId === undefined) {
      throw new Error(
        `Cannot find role definition id for role name ${step.roleAssignment.roleName}`
      );
    }

    const req: ApiScenarioClientRequest = {
      host: env.getRequiredString("armEndpoint"),
      method: "PUT",
      path: "/$(scope)/providers/Microsoft.Authorization/roleAssignments/$(roleAssignmentName)",
      pathParameters: parameters,
      headers: {},
      query: { "api-version": DEFAULT_ROLE_ASSIGNMENT_API_VERSION },
      body: {
        properties: {
          roleDefinitionId: `/subscriptions/$(subscriptionId)/providers/Microsoft.Authorization/roleDefinitions/${roleDefinitionId}`,
          principalId: step.roleAssignment.principalId,
          principalType: step.roleAssignment.principalType ?? "ServicePrincipal",
        },
      },
    };

    const newStep: StepRestCall = {
      operation: {
        parameters: [
          { name: "scope", [xmsSkipUrlEncoding]: true, in: "path" },
          { name: "roleAssignmentName", [xmsSkipUrlEncoding]: true, in: "path" },
        ],
      } as any,
      isPrepareStep: step.isPrepareStep,
      isCleanUpStep: step.isCleanUpStep,
      step: step.step,
      variables: step.variables,
      secretVariables: step.secretVariables,
      requiredVariables: step.requiredVariables,
      type: "restCall",
      operationId: "RoleAssignments_Create",
      responses: {},
      parameters: parameters,
      authentication: step.authentication,
      externalReference: true,
    };

    await this.client.sendRestCallRequest(req, newStep, env);
  }

  private async executeRestCallStep(step: StepRestCall, env: VariableEnv) {
    let req: ApiScenarioClientRequest = {
      host: "",
      method: step.operation!._method.toUpperCase() as HttpMethods,
      path: step.operation!._path._pathTemplate.replace(
        /{([a-z0-9-_$]+)}/gi,
        (_, p1) => `$(${p1})`
      ),
      pathParameters: {},
      headers: {},
      query: {},
    };

    for (const p of step.operation!.parameters ?? []) {
      const param = this.jsonLoader.resolveRefObj(p);

      const paramVal = step.parameters[param.name];
      if (paramVal === undefined) {
        if (param.required) {
          throw new Error(`Parameter value for "${param.name}" is not found in step: ${step.step}`);
        } else {
          continue;
        }
      }

      switch (param.in) {
        case "path":
          req.pathParameters![param.name] = paramVal;
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

    if (step.isManagementPlane) {
      req.host = env.getRequiredString("armEndpoint");
    } else {
      const spec = step.operation!._path._spec;
      if (spec.host) {
        req.host = `https://${spec.host}`;
      } else {
        const xHost = spec["x-ms-parameterized-host"];
        if (xHost) {
          req.host = xHost.hostTemplate.replace(/{([a-z0-9-_$]+)}/gi, (_, p1) => `$(${p1})`);
          if (xHost.useSchemePrefix === undefined || xHost.useSchemePrefix) {
            req.host = `https://${req.host}`;
          }
        } else {
          throw new Error("Unknown host");
        }
      }
    }

    await this.client.sendRestCallRequest(req, step, env);
  }

  private async executeArmTemplateStep(step: StepArmTemplate, env: VariableEnv, scope: Scope) {
    const subscriptionId = env.getRequiredString("subscriptionId");
    const resourceGroupName = env.getRequiredString("resourceGroupName");

    const armDeployment: ArmDeployment = {
      deploymentName: `${resourceGroupName}-deploy-${getRandomString()}`,
      step,
      details: {
        scope: scope.type,
        subscriptionId,
        resourceGroupName,
      },
    };

    await this.client.sendArmTemplateDeployment(
      scope.env.getRequiredString("armEndpoint"),
      step.armTemplatePayload,
      armDeployment,
      step,
      env
    );
  }
}
