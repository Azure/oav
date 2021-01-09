import {
  getDefaultUserAgentValue,
  ServiceClient,
  ServiceClientOptions,
  TokenCredential,
} from "@azure/core-http";
import { TokenCredentials as MsRestTokenCredential } from "@azure/ms-rest-js";
import { LROPoller } from "@azure/ms-rest-azure-js";
import { setDefaultOpts } from "../swagger/loader";
import { ResourceManagementClient } from "@azure/arm-resources";
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
  private credential: TokenCredential;

  constructor(credential: TokenCredential, opts: TestScenarioRestClientOption) {
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

  public async createResourceGroup(
    subscriptionId: string,
    resourceGroupName: string,
    location: string,
  ): Promise<void> {
    console.log(`Create ResourceGroup: ${resourceGroupName}`);
    const resourcesClient = new ResourceManagementClient(await this.getMsRestCredential(), subscriptionId);
    await resourcesClient.resourceGroups.createOrUpdate(resourceGroupName, {
      location
    });
  };

  public async deleteResourceGroup(
    subscriptionId: string,
    resourceGroupName: string,
  ): Promise<void> {
    console.log(`Delete ResourceGroup: ${resourceGroupName}`);
    const resourcesClient = new ResourceManagementClient(await this.getMsRestCredential(), subscriptionId);
    const poller = await resourcesClient.resourceGroups.beginDeleteMethod(resourceGroupName);
    await this.fastPoll(poller);
  };

  public async sendExampleRequest(
    req: TestScenarioClientRequest,
    step: TestStepExampleFileRestCall,
    _stepEnv: TestStepEnv,
  ): Promise<void> {
    console.log(`Send request: ${req.method} ${req.path}`);
    const url = new URL(req.path, this.opts.endpoint!);
    for (const queryName of Object.keys(req.query)) {
      url.searchParams.set(queryName, req.query[queryName]);
    }

    if (step.operation["x-ms-long-running-operation"]) {

    }

    const result = await this.sendRequest({
      url: url.href,
      method: req.method,
      headers: req.headers,
      body: req.body,
    });

    if (result.status >= 400) {
      throw new Error(`Fail to send request ${req.method} ${req.path}:\n${result.bodyAsText}`);
    }

    console.log(result);
  }

  public async sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    params: { [name: string]: string },
    armDeployment: ArmDeploymentTracking,
    _step: TestStepArmTemplateDeployment,
    _stepEnv: TestStepEnv
  ) {
    console.log(`Deploy ARM template ${armDeployment.deploymentName}`);
    const { subscriptionId, resourceGroupName } = armDeployment.details;
    const resourcesClient = new ResourceManagementClient(await this.getMsRestCredential(), subscriptionId);
    const poller = await resourcesClient.deployments.beginCreateOrUpdate(resourceGroupName, armDeployment.deploymentName, {
      properties: {
        mode: "Complete",
        template: armTemplate,
        parameters: params
      }
    });
    await this.fastPoll(poller);

    const outputs = poller.getMostRecentResponse().parsedBody;
    // stepEnv.env.setBatch(outputs);
    console.log(outputs);
  }

  private async getMsRestCredential() {
    const token = await this.credential.getToken(this.opts.credentialScopes!);
    return new MsRestTokenCredential(token!.token);
  }

  private async fastPoll(poller: LROPoller) {
    let delayInSeconds = 1;
    while (!poller.isFinished()) {
      await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
      if (delayInSeconds < 4) {
        delayInSeconds = delayInSeconds * 2;
      }
      console.log("Polling...");
      await poller.poll();
    }
  }
}
