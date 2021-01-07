import { getDefaultAzureCredential, TokenCredential } from "@azure/identity";
import { ServiceClient } from "@azure/core-http";
import { setDefaultOpts } from "../swagger/loader";

export interface TestScenarioRunnerOption {
  credential: TokenCredential;
  resource?: string;
}

export class TestScenarioRunner {
  constructor(private opts: TestScenarioRunnerOption) {
    setDefaultOpts(opts, {
      credential: getDefaultAzureCredential()
      resource: "https://management.azure.com",
    });
  }
}