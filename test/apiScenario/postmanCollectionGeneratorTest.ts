import { PostmanCollectionGenerator } from "../../lib/apiScenario/postmanCollectionGenerator";
import { inversifyGetInstance } from "../../lib/inversifyUtils";
import { resetPsuedoRandomSeed, usePsudorandom } from "../../lib/util/utils";

describe("postmanCollectionGenerator", () => {
  beforeAll(() => {
    usePsudorandom.flag = true;
  });

  beforeEach(() => {
    resetPsuedoRandomSeed();
  });

  it("should generate PostmanCollection - storageQuickStart", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
      scenarioFiles: ["Microsoft.Storage/stable/2021-08-01/scenarios/storageQuickStart.yaml"],
      fileRoot: "test/apiScenario/fixtures/specification/storage/resource-manager/",
      checkUnderFileRoot: false,
      generateCollection: true,
      runCollection: false,
      env: {
        subscriptionId: "00000000-0000-0000-0000-000000000000",
        location: "westus",
      },
      swaggerFilePaths: ["Microsoft.Storage/stable/2021-08-01/storage.json"],
      outputFolder: "generated",
      runId: "jestRunId",
    });
    const collections = await generator.run();
    expect(collections[0]).toMatchSnapshot();
  });

  it("should generate PostmanCollection - enableTestProxy", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
      scenarioFiles: ["Microsoft.Storage/stable/2021-08-01/scenarios/storageQuickStart.yaml"],
      fileRoot: "test/apiScenario/fixtures/specification/storage/resource-manager/",
      checkUnderFileRoot: false,
      generateCollection: true,
      runCollection: false,
      env: {
        subscriptionId: "00000000-0000-0000-0000-000000000000",
        location: "westus",
      },
      swaggerFilePaths: ["Microsoft.Storage/stable/2021-08-01/storage.json"],
      outputFolder: "generated",
      runId: "jestRunIdTestProxy",
      testProxy: "http://localhost:5000",
    });
    const collections = await generator.run();
    expect(collections[0]).toMatchSnapshot();
  });

  it("should generate PostmanCollection - storageBasicExample", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
      scenarioFiles: ["Microsoft.Storage/stable/2021-08-01/scenarios/storageBasicExample.yaml"],
      fileRoot: "test/apiScenario/fixtures/specification/storage/resource-manager/",
      eraseXmsExamples: false,
      checkUnderFileRoot: false,
      generateCollection: true,
      runCollection: false,
      env: {
        subscriptionId: "00000000-0000-0000-0000-000000000000",
        location: "westus",
      },
      swaggerFilePaths: ["Microsoft.Storage/stable/2021-08-01/storage.json"],
      outputFolder: "generated",
      runId: "jestRunId",
    });
    const collections = await generator.run();
    expect(collections[0]).toMatchSnapshot();
  });

  it("should generate PostmanCollection - testKeyReplace", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
      scenarioFiles: ["Microsoft.Storage/stable/2021-08-01/scenarios/testKeyReplace.yaml"],
      fileRoot: "test/apiScenario/fixtures/specification/storage/resource-manager/",
      eraseXmsExamples: false,
      checkUnderFileRoot: false,
      generateCollection: true,
      runCollection: false,
      env: {
        subscriptionId: "00000000-0000-0000-0000-000000000000",
        location: "westus",
      },
      swaggerFilePaths: ["Microsoft.Storage/stable/2021-08-01/storage.json"],
      outputFolder: "generated",
      runId: "jestRunId",
    });
    const collections = await generator.run();
    expect(collections[0]).toMatchSnapshot();
  });

  it("should generate PostmanCollection - appconfig data plane", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
      scenarioFiles: ["Microsoft.AppConfiguration/stable/1.0/scenarios/test.yaml"],
      fileRoot: "test/apiScenario/fixtures/specification/appconfiguration/data-plane/",
      checkUnderFileRoot: false,
      generateCollection: true,
      runCollection: false,
      env: {
        subscriptionId: "00000000-0000-0000-0000-000000000000",
        location: "westus",
      },
      swaggerFilePaths: ["Microsoft.AppConfiguration/stable/1.0/appconfiguration.json"],
      outputFolder: "generated",
      runId: "jestRunId",
    });
    const collections = await generator.run();
    expect(collections[0]).toMatchSnapshot();
  });
});
