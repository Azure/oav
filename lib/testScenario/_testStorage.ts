import { PostmanCollectionGenerator } from "./postmanCollectionGenerator";

// oav generate-postmanCollection testScenario --env
const main = async () => {
  const env = {
    subscriptionId: "db5eb68e-73e2-4fa8-b18a-46cd1be4cce5",
    location: "eastasia",
    scope: "subscriptions/db5eb68e-73e2-4fa8-b18a-46cd1be4cce5",
    resourceId: "mysourceid",
    tenantId: "72f988bf-86f1-41af-91ab-2d7cd011db47",
    client_id: "40fdd0a8-9491-413f-b5dc-86da72815773",
    client_secret: "y_-5vSHgw11tFOsu8RI4s-lx_w8_2M4FKO",
    resourceGroupName: "ruowan-test",
    deploymentName: "createVMSS",
  };

  const postmanCollectionGenerator = new PostmanCollectionGenerator({
    name: "storage",
    fileRoot: "/home/ruowan/work/azure-rest-api-specs/specification/storage/resource-manager",
    swaggerFilePaths: [
      "Microsoft.Storage/stable/2019-06-01/storage.json",
      "Microsoft.Storage/stable/2019-06-01/blob.json",
    ],
    testDef: "Microsoft.Storage/stable/2019-06-01/test-scenairos/createStorageAccount.yaml",
    env: env,
    outputFolder: "./fixtures",
  });

  try {
    await postmanCollectionGenerator.GenerateCollection();
  } catch (e) {
    console.log(e.message, e.stack);
  } finally {
    // await runner.cleanAllTestScope();
  }
};

console.time("TestLoad");
console.log("Start");

main().finally(() => {
  console.timeEnd("TestLoad");
});
