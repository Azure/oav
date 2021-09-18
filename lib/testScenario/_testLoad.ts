import "reflect-metadata";

import { dirname } from "path";
import { getDefaultAzureCredential } from "@azure/identity";
import { getAutorestConfig } from "../util/getAutorestConfig";
import { ApiScenarioLoader } from "./apiScenarioLoader";
import { ApiScenarioRunner } from "./apiScenarioRunner";
import { VariableEnv } from "./variableEnv";
import { ApiScenarioRestClient } from "./apiScenarioRestClient";

const main = async () => {
  const readmeMd: string =
    "/home/htc/azure-rest-api-specs/specification/containerservice/resource-manager/readme.md";
  // "/home/htc/azure-rest-api-specs/specification/network/resource-manager/readme.md";
  // "/home/htc/azure-rest-api-specs/specification/operationalinsights/resource-manager/readme.md";
  const argv = {
    ["try-require"]: "readme.test.md",
    tag: "package-2020-12",
  };

  const autorestConfig = await getAutorestConfig(argv, readmeMd);
  const swaggerFilePaths: string[] = autorestConfig["input-file"];
  const fileRoot = dirname(readmeMd);

  console.log("input-file:");
  console.log(swaggerFilePaths);

  const loader = ApiScenarioLoader.create({
    useJsonParser: false,
    checkUnderFileRoot: false,
    fileRoot,
    swaggerFilePaths,
  });

  const testDef = await loader.load(
    // "Microsoft.ContainerService/stable/2020-07-01/test-scenarios/testAks.yml"
    // "Microsoft.OperationalInsights/stable/2020-08-01/test-scenarios/testDataExport.yaml"
    // "Microsoft.Network/stable/2020-08-01/test-scenarios/testNetworkPublicIp.yaml"
    "Microsoft.ContainerService/stable/2020-12-01/test-scenarios/containerService.yaml"
  );

  console.log(testDef.scenarios[0].steps);

  const env = new VariableEnv();
  env.setBatch({
    subscriptionId: "db5eb68e-73e2-4fa8-b18a-46cd1be4cce5",
    location: "westus",
    SSH_PUBLIC_KEY: "__public_key_ssh__",
  });

  const runner = new ApiScenarioRunner({
    jsonLoader: loader.jsonLoader,
    env,
    client: new ApiScenarioRestClient(getDefaultAzureCredential(), {}),
  });

  try {
    // for (const scenario of testDef.testScenarios) {
    //   await runner.executeScenario(scenario);
    // }
    await runner.executeScenario(testDef.scenarios[0]);
  } catch (e) {
    console.log(e.message, e.stack);
  } finally {
    console.timeLog("TestLoad");
    await runner.cleanAllScope();
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
