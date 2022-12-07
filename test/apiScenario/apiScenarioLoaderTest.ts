import { pathDirName } from "@azure-tools/openapi-tools-common";
import { ApiScenarioLoader } from "../../lib/apiScenario/apiScenarioLoader";

describe("ApiScenarioLoader", () => {
  it("load valid scenario - storage", async () => {
    const fileRoot = "test/apiScenario/fixtures/specification/storage/resource-manager/";

    const loader = ApiScenarioLoader.create({
      useJsonParser: false,
      checkUnderFileRoot: false,
      fileRoot,
      includeOperation: false,
    });

    const testDef = await loader.load(
      "Microsoft.Storage/stable/2021-08-01/scenarios/storageQuickStart.yaml",
      ["Microsoft.Storage/stable/2021-08-01/storage.json"]
    );

    expect(testDef).toMatchSnapshot();
  });

  it("load valid example based scenario - storage", async () => {
    const fileRoot = "test/apiScenario/fixtures/specification/storage/resource-manager/";

    const loader = ApiScenarioLoader.create({
      useJsonParser: false,
      eraseXmsExamples: false,
      checkUnderFileRoot: false,
      fileRoot,
      includeOperation: false,
    });

    const testDef = await loader.load(
      "Microsoft.Storage/stable/2021-08-01/scenarios/storageBasicExample.yaml",
      ["Microsoft.Storage/stable/2021-08-01/storage.json"]
    );

    expect(testDef).toMatchSnapshot();
  });

  it("load valid data-plane scenario - appconfig", async () => {
    const fileRoot = "test/apiScenario/fixtures/specification/appconfiguration/data-plane/";

    const loader = ApiScenarioLoader.create({
      useJsonParser: false,
      checkUnderFileRoot: false,
      fileRoot,
      includeOperation: false,
    });

    const testDef = await loader.load("Microsoft.AppConfiguration/stable/1.0/scenarios/crud.yaml", [
      "Microsoft.AppConfiguration/stable/1.0/appconfiguration.json",
    ]);

    expect(testDef).toMatchSnapshot();
  });

  it.skip("load valid cross-RP scenario - compute", async () => {
    const fileRoot = "test/apiScenario/fixtures/specification/compute/resource-manager/";

    const loader = ApiScenarioLoader.create({
      useJsonParser: false,
      checkUnderFileRoot: false,
      fileRoot,
      includeOperation: false,
    });

    const testDef = await loader.load(
      "Microsoft.Compute/stable/2021-11-01/scenarios/quickstart.yaml",
      ["Microsoft.Compute/stable/2021-11-01/compute.json"]
    );

    expect(testDef).toMatchSnapshot();
  });

  it.skip("load valid scenario with deps - compute", async () => {
    const fileRoot = "test/apiScenario/fixtures/specification/compute/resource-manager/";

    const loader = ApiScenarioLoader.create({
      useJsonParser: false,
      checkUnderFileRoot: false,
      fileRoot,
      includeOperation: false,
    });

    const testDef = await loader.load(
      "Microsoft.Compute/stable/2021-11-01/scenarios/quickstart_deps.yaml",
      ["Microsoft.Compute/stable/2021-11-01/compute.json"]
    );

    expect(testDef).toMatchSnapshot();
  });

  it.skip("load valid example based scenario - appplatform", async () => {
    const fileRoot = "test/apiScenario/fixtures/specification/appplatform/resource-manager/";

    const loader = ApiScenarioLoader.create({
      useJsonParser: false,
      checkUnderFileRoot: false,
      fileRoot,
      includeOperation: false,
    });

    const testDef = await loader.load(
      "Microsoft.AppPlatform/preview/2020-11-01-preview/scenarios/Spring.yaml",
      ["Microsoft.AppPlatform/preview/2020-11-01-preview/appplatform.json"]
    );

    expect(testDef).toMatchSnapshot();
  });

  it("load valid scenario from uri", async () => {
    const readmeMd: string =
      "https://github.com/Azure/azure-rest-api-specs/blob/23117e9/specification/signalr/resource-manager/readme.md";
    const fileRoot = pathDirName(readmeMd);

    const loader = ApiScenarioLoader.create({
      useJsonParser: false,
      eraseXmsExamples: false,
      checkUnderFileRoot: false,
      fileRoot,
      includeOperation: false,
    });

    const testDef = await loader.load(
      "Microsoft.SignalRService/preview/2021-06-01-preview/scenarios/signalR.yaml",
      ["Microsoft.SignalRService/preview/2021-06-01-preview/signalr.json"]
    );
    expect(testDef).toMatchSnapshot();
  }, 20000);
});
