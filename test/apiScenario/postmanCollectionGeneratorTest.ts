import { DEFAULT_ARM_ENDPOINT } from "../../lib/apiScenario/constants";
import { PostmanCollectionGenerator } from "../../lib/apiScenario/postmanCollectionGenerator";
import { inversifyGetInstance } from "../../lib/inversifyUtils";
import { resetPseudoRandomSeed } from "../../lib/util/utils";

describe("postmanCollectionGenerator", () => {
  beforeEach(() => {
    resetPseudoRandomSeed(0);
  });

  it("should generate PostmanCollection - storageQuickStart", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
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
    const collection = await generator.run(
      "Microsoft.Storage/stable/2021-08-01/scenarios/storageQuickStart.yaml"
    );
    expect(collection).toMatchSnapshot();
  });

  it("should generate PostmanCollection - enableTestProxy", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
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
    const collection = await generator.run(
      "Microsoft.Storage/stable/2021-08-01/scenarios/storageQuickStart.yaml"
    );
    expect(collection).toMatchSnapshot();
  });

  it("should generate PostmanCollection - storageBasicExample", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
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
    const collection = await generator.run(
      "Microsoft.Storage/stable/2021-08-01/scenarios/storageBasicExample.yaml"
    );
    expect(collection).toMatchSnapshot();
  });

  it("should generate PostmanCollection - testKeyReplace", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
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
    const collection = await generator.run(
      "Microsoft.Storage/stable/2021-08-01/scenarios/testKeyReplace.yaml"
    );
    expect(collection).toMatchSnapshot();
  });

  it("should generate PostmanCollection - appconfig data plane", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
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
    const collection = await generator.run(
      "Microsoft.AppConfiguration/stable/1.0/scenarios/test.yaml"
    );
    expect(collection).toMatchSnapshot();
  });

  it("should generate PostmanCollection - cognitiveservices language data plane", async () => {
    const generator = inversifyGetInstance(PostmanCollectionGenerator, {
      fileRoot: "test/apiScenario/fixtures/specification/cognitiveservices/data-plane/",
      checkUnderFileRoot: false,
      generateCollection: true,
      runCollection: false,
      env: {
        subscriptionId: "00000000-0000-0000-0000-000000000000",
        location: "westus",
        armEndpoint: DEFAULT_ARM_ENDPOINT,
      },
      swaggerFilePaths: [
        "Language/preview/2022-10-01-preview/analyzeconversations-authoring.json",
        "Language/preview/2022-10-01-preview/analyzetext.json",
      ],
      outputFolder: "generated",
      runId: "jestRunId",
    });
    const collection = await generator.run(
      "Language/preview/2022-10-01-preview/scenarios/ConversationAuthoring.yaml"
    );
    expect(collection).toMatchSnapshot();
  });
});
