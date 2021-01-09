import { TestResourceLoader } from "./testResourceLoader";
import { TestScenarioRunner } from "./testScenarioRunner";
import { VariableEnv } from "./variableEnv";

const main = async () => {
  const loader = new TestResourceLoader({
    useJsonParser: false,
    checkUnderFileRoot: false,
    fileRoot: "/home/htc/azure-rest-api-specs/specification/operationalinsights/resource-manager",
    swaggerFilePaths: [
      "Microsoft.OperationalInsights/stable/2020-08-01/DataExports.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/DataSources.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/IntelligencePacks.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/LinkedServices.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/LinkedStorageAccounts.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/ManagementGroups.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/Operations.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/OperationStatuses.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/SharedKeys.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/Usages.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/Workspaces.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/Clusters.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/StorageInsightConfigs.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/SavedSearches.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/AvailableServiceTiers.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/Gateways.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/Schema.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/SharedKeys.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/WorkspacePurge.json",
      "Microsoft.OperationalInsights/stable/2020-08-01/Tables.json",
    ],
  });

  const testDef = await loader.load(
    "Microsoft.OperationalInsights/stable/2020-08-01/test-scenarios/testDataExport.yaml"
  );

  console.log(testDef);

  const env = new VariableEnv();
  env.setBatch({
    subscriptionId: "db5eb68e-73e2-4fa8-b18a-46cd1be4cce5",
    location: "eastasia"
  });

  const runner = new TestScenarioRunner({ 
    jsonLoader: loader.jsonLoader,
    env,
  });

  try {
    await runner.executeScenario(testDef.testScenarios[0]);
  } catch (e) {
    console.log(e.message, e.stack);
  } finally {
    await runner.cleanAllTestScope();
  }
};

console.time("TestLoad");
console.log("Start");

main().finally(() => {
  console.timeEnd("TestLoad");
});
