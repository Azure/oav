import { getDefaultAzureCredential, TokenCredential } from "@azure/identity";
import { setDefaultOpts } from "../swagger/loader";

export interface TestScenarioRunnerOption {
  credential: TokenCredential;
  resource?: string;
}

export class TestScenarioRunner {
  constructor(opts: TestScenarioRunnerOption) {
    setDefaultOpts(opts, {
      credential: getDefaultAzureCredential(),
      resource: "https://management.azure.com",
    });
  }
}