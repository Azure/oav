import "reflect-metadata";

// import { pathDirName } from "@azure-tools/openapi-tools-common";
import { ApiScenarioLoader } from "../../lib/apiScenario/apiScenarioLoader";

describe("ApiScenarioLoader", () => {
  it("load valid scenario", async () => {
    const fileRoot = "test/apiScenario/fixtures/specification/storage/resource-manager/";

    const loader = ApiScenarioLoader.create({
      useJsonParser: false,
      checkUnderFileRoot: false,
      fileRoot,
      swaggerFilePaths: ["Microsoft.Storage/stable/2021-09-01/storage.json"],
      includeOperation: false,
    });

    const testDef = await loader.load(
      "Microsoft.Storage/stable/2021-09-01/scenarios/storageQuickStart.yaml"
    );

    expect(testDef).toMatchSnapshot();
  });

  // it("load valid scenario from uri", async () => {
  //   const readmeMd: string =
  //     "https://github.com/Azure/azure-rest-api-specs/blob/apiscenario/specification/appplatform/resource-manager/readme.md";
  //   const fileRoot = pathDirName(readmeMd);

  //   const loader = ApiScenarioLoader.create({
  //     useJsonParser: false,
  //     checkUnderFileRoot: false,
  //     fileRoot,
  //     swaggerFilePaths: ["Microsoft.AppPlatform/preview/2020-11-01-preview/appplatform.json"],
  //   });

  //   const testDef = await loader.load(
  //     "Microsoft.AppPlatform/preview/2020-11-01-preview/scenarios/Spring.yaml"
  //   );
  //   expect(testDef).toMatchSnapshot();
  // });
});
