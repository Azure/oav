import { DefaultAzureCredential } from "@azure/identity";
import { ResourceManagementClient } from "@azure/arm-resources";
import { TokenCredentials } from "@azure/ms-rest-js";

const templatePayload = {
  $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
  contentVersion: "1.0.0",
  variables: {},
  resources: [],
  outputs: {
    storageAccountName: {
      type: "string",
      value: "[uniqueString(resourceGroup().id)]",
    },
  },
};

const main = async () => {
  console.time("ARM Template deployment");
  console.log("ARM Template deployment");
  const cred = new DefaultAzureCredential();
  const token = await cred.getToken("https://management.azure.com");

  const client = new ResourceManagementClient(
    new TokenCredentials(token!.token),
    "4e7b30e5-96b6-4d26-ae34-bd0b75fdafb4",
    {
      longRunningOperationRetryTimeout: 30,
    }
  );
  const poller = await client.deployments.beginCreateOrUpdate("tih-test", "test1234", {
    properties: {
      mode: "Complete",
      template: templatePayload,
    },
  });

  while (true) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("poll");
    const pollResult = await poller.poll();
    console.log(pollResult);
    if (pollResult === "Succeeded") {
      break;
    }
  }

  console.log(poller.getMostRecentResponse().parsedBody);
  console.timeEnd("ARM Template deployment");
};

main();
