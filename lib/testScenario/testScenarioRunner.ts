import { HttpMethods } from "@azure/core-http";
import { JsonLoader } from "../swagger/jsonLoader";
import { setDefaultOpts } from "../swagger/loader";
import { getLazyBuilder } from "../util/lazyBuilder";
import {
  ArmTemplate,
  TestDefinitionFile,
  TestScenario,
  TestStep,
  TestStepArmTemplateDeployment,
  TestStepExampleFileRestCall,
} from "./testResourceTypes";
import { VariableEnv } from "./variableEnv";

export interface TestScenarioRunnerOption {
  env: VariableEnv;
  client: TestScenarioRunnerClient;
  jsonLoader: JsonLoader;
}

export interface ArmDeploymentTracking {
  deploymentName: string;
  step: TestStepArmTemplateDeployment;
  details: {
    scope: "ResourceGroup";
    subscriptionId: string;
    resourceGroupName: string;
  };
}

interface TestScopeTracking {
  provisioned?: boolean;
  scope: TestDefinitionFile["scope"];
  prepareSteps: TestStep[];
  env: VariableEnv;
  armDeployments: ArmDeploymentTracking[];
}

export interface TestStepEnv {
  env: VariableEnv;
  scope: TestDefinitionFile["scope"];
  armDeployments: ArmDeploymentTracking[];
}

export interface TestScenarioClientRequest {
  method: HttpMethods;
  path: string;
  headers: { [headerName: string]: string };
  query: { [headerName: string]: string };
  body?: any;
}

export interface TestScenarioRunnerClient {
  createResourceGroup(
    subscriptionId: string,
    resourceGroupName: string,
    location: string
  ): Promise<void>;

  deleteResourceGroup(subscriptionId: string, resourceGroupName: string): Promise<void>;

  sendExampleRequest(
    request: TestScenarioClientRequest,
    step: TestStepExampleFileRestCall,
    stepEnv: TestStepEnv
  ): Promise<void>;

  sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    params: { [name: string]: any },
    armDeployment: ArmDeploymentTracking,
    step: TestStepArmTemplateDeployment,
    stepEnv: TestStepEnv
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

const pathParamRegex = /{(.+?)}/g;
const resolvePathTemplate = (pathTemplate: string, env: VariableEnv) => {
  let result = pathTemplate;
  let offset = 0;

  const matches = pathTemplate.matchAll(pathParamRegex);
  for (const match of matches) {
    const idx = match.index! + offset;
    const toReplace = env.getRequired(match[1]);
    result = result.substr(0, idx) + toReplace + result.substr(idx + match[0].length);
    offset = offset + toReplace.length - match[0].length;
  }

  return result;
};

export class TestScenarioRunner {
  private jsonLoader: JsonLoader;
  private client: TestScenarioRunnerClient;
  private env: VariableEnv;
  private testScopeTracking: { [scopeName: string]: TestScopeTracking };

  private provisionTestScope = getLazyBuilder(
    "provisioned",
    async (testScope: TestScopeTracking) => {
      if (testScope.scope !== "ResourceGroup") {
        throw new Error(`TestScope is not supported yet: ${testScope.scope}`);
      }

      const subscriptionId = testScope.env.getRequired("subscriptionId");
      const location = testScope.env.getRequired("location");
      const resourceGroupPrefix = testScope.env.get("resourceGroupPrefix") ?? "test-";
      const resourceGroupName =
        resourceGroupPrefix +
        getRandomString({ length: 6, lowerCase: true, upperCase: false, number: false });
      testScope.env.setBatch({ resourceGroupName });

      await this.client.createResourceGroup(subscriptionId, resourceGroupName, location);

      for (const step of testScope.prepareSteps) {
        await this.executeStep(step, testScope.env, testScope);
      }

      return true;
    }
  );

  public constructor(opts: TestScenarioRunnerOption) {
    this.env = opts.env;
    this.client = opts.client;
    this.jsonLoader = opts.jsonLoader;
    this.testScopeTracking = {};
  }

  public async prepareScenario(testScenario: TestScenario): Promise<TestScopeTracking> {
    const s = testScenario.shareTestScope;
    const testScopeName =
      typeof s === "string" ? s : s ? "_defaultScope" : `_randomScope_${getRandomString()}`;

    let testScope = this.testScopeTracking[testScopeName];
    if (testScope === undefined) {
      const testDef = testScenario._testDef;
      const env = new VariableEnv(this.env);
      env.setBatch(testDef.variables);
      testScope = {
        scope: testDef.scope,
        prepareSteps: testDef.prepareSteps,
        env,
        armDeployments: [],
      };
      this.testScopeTracking[testScopeName] = testScope;
    }

    await this.provisionTestScope(testScope);
    return testScope;
  }

  public async executeScenario(testScenario: TestScenario) {
    const testScope = await this.prepareScenario(testScenario);
    const env = new VariableEnv(testScope.env);
    env.setBatch(testScenario.variables);

    for (const step of testScenario.steps) {
      await this.executeStep(step, env, testScope);
    }
  }

  public async executeStep(step: TestStep, env: VariableEnv, testScope: TestScopeTracking) {
    const stepEnv = new VariableEnv(env);
    stepEnv.setBatch(step.variables);
    stepEnv.setWriteEnv(env);

    switch (step.type) {
      case "exampleFile":
        await this.executeExampleFileStep(step, env, testScope);
        break;

      case "armTemplateDeployment":
        await this.executeArmTemplateStep(step, env, testScope);
        break;
    }
  }

  public async cleanAllTestScope() {
    for (const testScope of Object.values(this.testScopeTracking)) {
      const subscriptionId = testScope.env.getRequired("subscriptionId");
      const resourceGroupName = testScope.env.getRequired("resourceGroupName");
      await this.client.deleteResourceGroup(subscriptionId, resourceGroupName);
    }
  }

  private async executeExampleFileStep(
    step: TestStepExampleFileRestCall,
    env: VariableEnv,
    testScope: TestScopeTracking
  ) {
    const operation = step.operation;

    const pathEnv = new VariableEnv();
    let req: TestScenarioClientRequest = {
      method: step.operation._method.toUpperCase() as HttpMethods,
      path: "",
      headers: {},
      query: {},
    };

    for (const p of operation.parameters ?? []) {
      const param = this.jsonLoader.resolveRefObj(p);
      const paramValue = step.exampleTemplate.parameters[param.name];
      if (paramValue === undefined) {
        if (param.required) {
          throw new Error(
            `Parameter value for "${param.name}" is not found in example: ${step.exampleFilePath}`
          );
        }
        continue;
      }

      switch (param.in) {
        case "path":
          pathEnv.set(param.name, paramValue);
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
    const pathTemplate = operation._path._pathTemplate;
    req.path = resolvePathTemplate(pathTemplate, pathEnv);
    req = env.resolveObjectValues(req);

    await this.client.sendExampleRequest(req, step, {
      env,
      scope: testScope.scope,
      armDeployments: testScope.armDeployments,
    });
  }

  private async executeArmTemplateStep(
    step: TestStepArmTemplateDeployment,
    env: VariableEnv,
    testScope: TestScopeTracking
  ) {
    let params: { [key: string]: any } = {};
    const paramsDef = step.armTemplatePayload.parameters ?? {};
    for (const paramName of Object.keys(paramsDef)) {
      const paramDef = paramsDef[paramName];
      if (paramDef.type !== "string") {
        continue;
      }

      let paramValue = env.get(paramName);
      if (paramValue === undefined) {
        continue;
      }

      paramValue = env.resolveString(paramValue);
      params[paramName] = paramValue;
    }

    if (step.armTemplateParametersPayload !== undefined) {
      params = { ...params, ...step.armTemplateParametersPayload.parameters };
    }

    const subscriptionId = env.getRequired("subscriptionId");
    const resourceGroupName = env.getRequired("resourceGroupName");

    const armDeployment: ArmDeploymentTracking = {
      deploymentName: `${resourceGroupName}-deploy-${getRandomString()}`,
      step,
      details: {
        scope: testScope.scope,
        subscriptionId,
        resourceGroupName,
      },
    };
    testScope.armDeployments.push(armDeployment);

    await this.client.sendArmTemplateDeployment(
      step.armTemplatePayload,
      params,
      armDeployment,
      step,
      {
        env,
        scope: testScope.scope,
        armDeployments: testScope.armDeployments,
      }
    );
  }
}
