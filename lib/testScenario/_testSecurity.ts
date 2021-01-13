import { getDefaultAzureCredential } from "@azure/identity";
import { TestScenarioRestClient } from "./testScenarioRestClient";
import { PostmanCollectionRunnerClient } from "./postmanCollectionRunnerClient";
import { TestResourceLoader } from "./testResourceLoader";
import { TestScenarioRunner } from "./testScenarioRunner";
import { ReflectiveVariableEnv, VariableEnv } from "./variableEnv";

const main = async () => {
  const loader = new TestResourceLoader({
    useJsonParser: false,
    checkUnderFileRoot: false,
    fileRoot: "/home/ruowan/work/azure-rest-api-specs/specification/security/resource-manager",
    swaggerFilePaths: [
      "Microsoft.Security/stable/2020-01-01/assessmentMetadata.json",
      "Microsoft.Security/stable/2020-01-01/assessments.json",
    ],
  });

  const testDef = await loader.load(
    "Microsoft.Security/stable/2020-01-01/test-scenarios/createAssessment.yaml"
  );

  console.log(testDef);

  const env = new VariableEnv();
  env.setBatch({
    subscriptionId: "db5eb68e-73e2-4fa8-b18a-46cd1be4cce5",
    location: "eastasia",
    scope: "subscriptions/db5eb68e-73e2-4fa8-b18a-46cd1be4cce5",
    resourceId: "mysourceid",
    tenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
    client_id: "40fdd0a8-9491-413f-b5dc-86da72815773",
    client_secret: "y_-5vSHgw11tFOsu8RI4s-lx_w8_2M4FKO",
    resourceGroupName: "ruowan-test",
    deploymentName: "createVMSS",
  });

  const postmanGenerator = new PostmanCollectionRunnerClient("security", loader.jsonLoader, env);
  const runner = new TestScenarioRunner({
    jsonLoader: loader.jsonLoader,
    env,
    client: postmanGenerator,
  });

  try {
    for (const step of testDef.prepareSteps) {
      await runner.executeScenario(testDef.testScenarios[0]);
    }
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
