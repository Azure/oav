import {
  getDefaultUserAgentValue,
  ServiceClient,
  ServiceClientCredentials,
  ServiceClientOptions,
  TokenCredential,
} from "@azure/core-http";
import { setDefaultOpts } from "../swagger/loader";
import {
  ArmTemplate,
  TestStepArmTemplateDeployment,
  TestStepExampleFileRestCall,
} from "./testResourceTypes";
import { TestScenarioClientRequest, TestScenarioRunnerClient } from "./testScenarioRunner";
import { VariableEnv } from "./variableEnv";

export interface TestScenarioRestClientOption extends ServiceClientOptions {
  endpoint?: string;
}

export class TestScenarioRestClient extends ServiceClient implements TestScenarioRunnerClient {
  constructor(
    credentials: TokenCredential | ServiceClientCredentials,
    opts: TestScenarioRestClientOption
  ) {
    setDefaultOpts(opts, {
      credentialScopes: ["https://management.azure.com/.default"],
      userAgent: `TestScenarioRunnerClient/1.0.0 ${getDefaultUserAgentValue()}`,
      endpoint: "https://management.azure.com",
    });
    super(credentials, opts);
    this.requestContentType = "application/json; charset=utf-8";
    this.baseUri = opts.endpoint;
  }

  public async sendExampleRequest(
    req: TestScenarioClientRequest,
    step: TestStepExampleFileRestCall,
    env: VariableEnv
  ): Promise<void> {
    this.sendRequest({

    })
  }

  public async sendArmTemplateDeployment(
    req: ArmTemplate,
    params: { [name: string]: string },
    step: TestStepArmTemplateDeployment,
    variableEnv: VariableEnv
  ) {}
}
