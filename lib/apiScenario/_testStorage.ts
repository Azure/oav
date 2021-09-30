import { inversifyGetInstance } from "../inversifyUtils";
import "reflect-metadata";
import { PostmanCollectionGenerator } from "./postmanCollectionGenerator";

// oav generate-postmanCollection testScenario --env
const main = async () => {
  const env = {
    subscriptionId: "db5eb68e-73e2-4fa8-b18a-46cd1be4cce5",
    location: "eastasia",
    scope: "subscriptions/db5eb68e-73e2-4fa8-b18a-46cd1be4cce5",
    resourceId: "mysourceid",
    tenantId: "<your tenantId>",
    client_id: "<your client_id>",
    client_secret: "<your client secret>",
    resourceGroupName: "ruowan-test",
    deploymentName: "createVMSS",
  };

  const postmanCollectionGenerator = inversifyGetInstance(PostmanCollectionGenerator, {
    name: "storage",
    fileRoot: "/home/ruowan/work/azure-rest-api-specs/specification/storage/resource-manager",
    swaggerFilePaths: [
      "Microsoft.Storage/stable/2019-06-01/storage.json",
      "Microsoft.Storage/stable/2019-06-01/blob.json",
    ],
    testDef: "Microsoft.Storage/stable/2019-06-01/test-scenairos/createStorageAccount.yaml",
    env: env,
    outputFolder: "./fixtures",
    generateCollection: true,
    runCollection: false,
  });

  try {
    await postmanCollectionGenerator.GenerateCollection();
  } catch (e) {
    console.log(e.message, e.stack);
  }
};

console.time("TestLoad");
console.log("Start");

main().finally(() => {
  console.timeEnd("TestLoad");
});
