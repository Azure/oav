import {
  getDefaultUserAgentValue,
  ServiceClient,
  ServiceClientCredentials,
  ServiceClientOptions,
  TokenCredential,
} from "@azure/core-http";
import { setDefaultOpts } from "../swagger/loader";
import { ResourceManagementClient } from "./arm-resources/src";
import {
  ArmTemplate,
  TestStepArmTemplateDeployment,
  TestStepExampleFileRestCall,
} from "./testResourceTypes";
import { ArmDeploymentTracking, TestScenarioClientRequest, TestScenarioRunnerClient, TestStepEnv } from "./testScenarioRunner";

export interface TestScenarioRestClientOption extends ServiceClientOptions {
  endpoint?: string;
}

export class TestScenarioRestClient extends ServiceClient implements TestScenarioRunnerClient {
  private opts: TestScenarioRestClientOption;
  private credential: TokenCredential | ServiceClientCredentials;

  constructor(credential: TokenCredential | ServiceClientCredentials, opts: TestScenarioRestClientOption) {
    setDefaultOpts(opts, {
      credentialScopes: ["https://management.azure.com/.default"],
      userAgent: `TestScenarioRunnerClient/1.0.0 ${getDefaultUserAgentValue()}`,
      endpoint: "https://management.azure.com",
    });
    super(credential, opts);
    this.requestContentType = "application/json; charset=utf-8";
    this.baseUri = opts.endpoint;
    this.opts = opts;
    this.credential = credential;
  }

  public async createResourceGruop(
    subscriptionId: string,
    resourceGroupName: string,
    location: string,
  ): Promise<void> {
    const resourcesClient = new ResourceManagementClient(this.credential, subscriptionId, this.opts);
    await resourcesClient.resourceGroups.createOrUpdate(resourceGroupName, {
      location
    });
  };

  public async sendExampleRequest(
    req: TestScenarioClientRequest,
    _step: TestStepExampleFileRestCall,
    _stepEnv: TestStepEnv,
  ): Promise<void> {
    const result = await this.sendRequest({
      url: req.path,
      method: req.method,
      query: req.query,
      headers: req.headers,
      body: req.body,
    });
    console.log(result);
  }

  public async sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    params: { [name: string]: string },
    armDeployment: ArmDeploymentTracking,
    _step: TestStepArmTemplateDeployment,
    stepEnv: TestStepEnv
  ) {
    const { subscriptionId, resourceGroupName } = armDeployment.details;
    const resourcesClient = new ResourceManagementClient(this.credential, subscriptionId, this.opts);
    const poller = await resourcesClient.deployments.createOrUpdate(resourceGroupName, subscriptionId, {
      properties: {
        mode: "Complete",
        template: armTemplate,
        parameters: params
      }
    });
    let delayInSeconds = 1;
    while (!poller.isDone()) {
      await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
      if (delayInSeconds <= 16) {
        delayInSeconds = delayInSeconds * 2;
      }
      await poller.poll();
    }

    const outputs = poller.getResult()?._response.parsedBody.properties?.outputs ?? {};
    stepEnv.env.setBatch(outputs);
    console.log(outputs);
  }
}
