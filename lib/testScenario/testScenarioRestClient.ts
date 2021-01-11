import {
  getDefaultUserAgentValue,
  ServiceClient,
  ServiceClientOptions,
  TokenCredential,
  RequestPrepareOptions,
  createPipelineFromOptions,
  isTokenCredential,
  bearerTokenAuthenticationPolicy,
  signingPolicy
} from "@azure/core-http";
import { TokenCredentials as MsRestTokenCredential } from "@azure/ms-rest-js";
import { setDefaultOpts } from "../swagger/loader";
import { ResourceManagementClient } from "@azure/arm-resources";
import {
  ArmTemplate,
  TestStepArmTemplateDeployment,
  TestStepExampleFileRestCall,
} from "./testResourceTypes";
import { ArmDeploymentTracking, TestScenarioClientRequest, TestScenarioRunnerClient, TestStepEnv } from "./testScenarioRunner";
import { LROPoller as MsLROPoller } from "@azure/ms-rest-azure-js";
import { LROPoller, BaseResult, lroPolicy } from "./lro";

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
      endpoint: "https://management.azure.com"
    });
    const credsPolicy = isTokenCredential(credential)
      ? bearerTokenAuthenticationPolicy(
          credential,
          "https://management.azure.com/.default"
        )
      : signingPolicy(credential);
    const pipeline = createPipelineFromOptions(opts, credsPolicy);
    if (Array.isArray(pipeline.requestPolicyFactories)){
      pipeline.requestPolicyFactories.unshift(lroPolicy());
    }

    super(credential, pipeline);

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
    await this.fastPollMsLROPoller(poller);
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

    const initialRequest = {
      url: url.href,
      method: req.method,
      headers: req.headers,
      body: req.body,
    };
    const sendOperation = async (request: RequestPrepareOptions): Promise<BaseResult> => {
      const result = await this.sendRequest(request);
      return {
        _response: result
      };
    }
    const result = await sendOperation(initialRequest);
    const { _response: initialResponse } = result;

    if (initialResponse.status >= 400) {
      throw new Error(`Fail to send request ${req.method} ${req.path}:\n${result.bodyAsText}`);
    }

    if (step.operation["x-ms-long-running-operation"]) {
      const poller = new LROPoller({
        initialRequestOptions: initialRequest,
        initialOperationResult: result,
        sendOperation,
      });

      await this.fastPollMsLROPoller(poller);
    }

    console.log(result);
  }

  public async sendArmTemplateDeployment(
    armTemplate: ArmTemplate,
    params: { [name: string]: string },
    armDeployment: ArmDeploymentTracking,
    _step: TestStepArmTemplateDeployment,
    stepEnv: TestStepEnv
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
    await this.fastPollMsLROPoller(poller);

    const deployResult = await resourcesClient.deployments.get(resourceGroupName, armDeployment.deploymentName);
    const outputs = deployResult.properties?.outputs;
    console.log(outputs);
    if (outputs) {
      for (const outputKey of Object.keys(outputs)) {
        stepEnv.env.set(outputKey, outputs[outputKey].value);
      }
    }
  }

  private async getMsRestCredential() {
    const token = await this.credential.getToken(this.opts.credentialScopes!);
    return new MsRestTokenCredential(token!.token);
  }

  private async fastPollMsLROPoller(poller: MsLROPoller | LROPoller<BaseResult>) {
    let delayInSeconds = 1;
    const isDone = "isFinished" in poller ? poller.isFinished : poller.isDone;
    while (!isDone.call(poller)) {
      await new Promise(resolve => setTimeout(resolve, delayInSeconds * 1000));
      if (delayInSeconds < 4) {
        delayInSeconds = delayInSeconds * 2;
      }
      console.log("Polling...");
      await poller.poll();
    }
  }
}
