import { getDefaultUserAgentValue, ServiceClient, ServiceClientCredentials, ServiceClientOptions, TokenCredential } from "@azure/core-http";
import { setDefaultOpts } from "../swagger/loader";

export interface TestScenarioRunnerClientOption extends ServiceClientOptions {
  endpoint?: string;
}

export class TestScenarioRunnerClient extends ServiceClient {
  constructor(credentials: TokenCredential | ServiceClientCredentials, opts: TestScenarioRunnerClientOption) {
    setDefaultOpts(opts, {
      credentialScopes: ["https://management.azure.com/.default"],
      userAgent: `TestScenarioRunnerClient/1.0.0 ${getDefaultUserAgentValue()}`,
      endpoint: "https://management.azure.com",
    });
    super(credentials, opts);
    this.requestContentType = "application/json; charset=utf-8";
    this.baseUri = opts.endpoint;
  }

  public async sendSomeRequest() {
  }
}
