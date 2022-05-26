import { PostmanCollectionGenerator } from "../../lib/apiScenario/postmanCollectionGenerator";
import { inversifyGetInstance } from "../../lib/inversifyUtils";
import { usePsudorandom } from "../../lib/util/utils";

usePsudorandom.flag = true;

describe("postmanCollectionGenerator", () => {
  it("should generate PostmanCollection - storageQuickStart", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
      name: "storageQuickStart",
      scenarioDef: "Microsoft.Storage/stable/2021-09-01/scenarios/storageQuickStart.yaml",
      fileRoot: "test/apiScenario/fixtures/specification/storage/resource-manager/",
      checkUnderFileRoot: false,
      generateCollection: true,
      runCollection: false,
      env: {
        subscriptionId: "00000000-0000-0000-0000-000000000000",
        location: "westus",
      },
      swaggerFilePaths: ["Microsoft.Storage/stable/2021-09-01/storage.json"],
      outputFolder: "generated",
      runId: "jestRunId",
    });
    const collection = await generator.GenerateCollection();
    expect(collection).toMatchSnapshot();
  });
});
