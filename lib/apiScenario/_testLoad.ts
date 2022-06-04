import "reflect-metadata";

import { getDefaultAzureCredential } from "@azure/identity";
import { pathDirName } from "@azure-tools/openapi-tools-common";
import { ApiScenarioLoader } from "./apiScenarioLoader";
import { ApiScenarioRunner } from "./apiScenarioRunner";
import { ApiScenarioRestClient } from "./apiScenarioRestClient";

const main = async () => {
  const readmeMd: string =
    "https://github.com/Azure/azure-rest-api-specs/blob/apiscenario/specification/appplatform/resource-manager/readme.md";
  const fileRoot = pathDirName(readmeMd);

  const loader = ApiScenarioLoader.create({
    useJsonParser: false,
    checkUnderFileRoot: false,
    fileRoot,
    swaggerFilePaths: ["Microsoft.AppPlatform/preview/2020-11-01-preview/appplatform.json"],
  });

  const testDef = await loader.load(
    "Microsoft.AppPlatform/preview/2020-11-01-preview/scenarios/Spring.yaml"
  );

  console.log(testDef.scenarios[0].steps);

  const runner = new ApiScenarioRunner({
    jsonLoader: loader.jsonLoader,
    env: {
      subscriptionId: "db5eb68e-73e2-4fa8-b18a-46cd1be4cce5",
      location: "westus",
      SSH_PUBLIC_KEY: "__public_key_ssh__",
    },
    client: new ApiScenarioRestClient(getDefaultAzureCredential(), {}),
  });

  try {
    // for (const scenario of testDef.testScenarios) {
    //   await runner.executeScenario(scenario);
    // }
    await runner.executeScenario(testDef.scenarios[0]);
  } catch (e) {
    console.log(e);
  } finally {
    console.timeLog("TestLoad");
  }
};

console.time("TestLoad");
console.log("Start");

main()
  .catch((e) => {
    console.error(e);
  })
  .finally(() => {
    console.timeEnd("TestLoad");
  });
