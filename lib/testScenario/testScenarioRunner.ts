import { getDefaultAzureCredential } from "@azure/identity";
import { JsonLoader } from "../swagger/jsonLoader";
import { setDefaultOpts } from "../swagger/loader";
import { getLazyBuilder } from "../util/lazyBuilder";
import {
  ArmTemplate,
  TestScenario,
  TestStep,
  TestStepArmTemplateDeployment,
  TestStepExampleFileRestCall,
} from "./testResourceTypes";
import { TestScenarioRestClient } from "./testScenarioRestClient";
import { VariableEnv } from "./variableEnv";

export interface TestScenarioRunnerOption {
  variableEnv?: VariableEnv;
  client?: TestScenarioRunnerClient;
  jsonLoader: JsonLoader;
}

interface TestScopeTracking {
  provisioned?: boolean;
  scope: string;
  prepareSteps: TestStep[];
  variableEnv: VariableEnv;
}

export interface TestScenarioClientRequest {
  path: string;
  headers: { [headerName: string]: string };
  query: { [headerName: string]: string };
  body: any;
}

export interface TestScenarioRunnerClient {
  sendExampleRequest(
    req: TestScenarioClientRequest,
    step: TestStepExampleFileRestCall,
    env: VariableEnv
  ): Promise<void>;

  sendArmTemplateDeployment(
    req: ArmTemplate,
    params: { [name: string]: string },
    step: TestStepArmTemplateDeployment,
    variableEnv: VariableEnv
  ): Promise<void>;
}

export class TestScenarioRunner {
  private jsonLoader: JsonLoader;
  private client: TestScenarioRunnerClient;
  private variableEnv: VariableEnv;
  private testScopeTracking: { [scopeName: string]: {} };

  private provisionTestScope = getLazyBuilder(
    "provisioned",
    async (testScopeTracking: TestScopeTracking) => {
      if (testScopeTracking.scope !== "ResourceGroup") {
        throw new Error(`TestScope is not supported yet: ${testScopeTracking.scope}`);
      }

      for (const step of testScopeTracking.prepareSteps) {
        await this.executeStep(step, testScopeTracking.variableEnv);
      }

      return true;
    }
  );

  constructor(opts: TestScenarioRunnerOption) {
    this.variableEnv = opts.variableEnv ?? new VariableEnv();
    this.client = opts.client ?? new TestScenarioRestClient(getDefaultAzureCredential(), {});
    this.jsonLoader = opts.jsonLoader;
    this.testScopeTracking = {};
  }

  public async prepareScenario(testScenario: TestScenario): Promise<VariableEnv> {
    const s = testScenario.shareTestScope;
    const testScopeName = typeof s === "string" ? s : s ? "_defaultScope" : `_randomScope${Math.random().toString(36)}`;
    let testScope = this.testScopeTracking[testScenario.shareTestScope];
  }

  public async executeScenario(testScenario: TestScenario) {
    const prepareEnv = await this.prepareScenario(testScenario);
    const env = new VariableEnv(prepareEnv);

    for (const step of testScenario.steps) {
      await this.executeStep(step, env);
    }
  }

  public async executeStep(step: TestStep, env: VariableEnv) {
    const stepEnv = new VariableEnv(env);
    stepEnv.setBatch(step.variables);
    stepEnv.setWriteEnv(env);

    switch (step.type) {
      case "exampleFile":
        await this.executeExampleFileStep(step, env);
        break;

      case "armTemplateDeployment":
        await this.executeArmTemplateStep(step, env);
        break;
    }
  }

  private async executeExampleFileStep(step: TestStepExampleFileRestCall, env: VariableEnv) {
    const operation = step.operation;

    const pathEnv = new VariableEnv();
    let req: TestScenarioClientRequest = {
      path: "",
      headers: {},
      query: {},
      body: {},
    };

    for (const p of operation.parameters ?? []) {
      const param = this.jsonLoader.resolveRefObj(p);
      const paramValue = step.exampleTemplate.parameters[param.name];
      if (paramValue === undefined) {
        throw new Error(
          `Parameter value for "${param.name}" is not found in example: ${step.exampleFilePath}`
        );
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
    req.path = pathEnv.resolveString(operation._path._pathTemplate, "{", "}");
    req = env.resolveObjectValues(req);
    console.log(req);

    await this.client.sendExampleRequest(req, step, env);
  }

  private async executeArmTemplateStep(step: TestStepArmTemplateDeployment, env: VariableEnv) {
    const params: { [key: string]: string } = {};
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

    await this.client.sendArmTemplateDeployment(step.armTemplatePayload, params, step, env);
  }
}
