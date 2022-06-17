import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { urlParse } from "@azure-tools/openapi-tools-common";
import { TestRecordingLoader } from "../../lib/apiScenario/gen/testRecordingLoader";
import { inversifyGetInstance } from "../../lib/inversifyUtils";
import { TestRecordingApiScenarioGenerator } from "../../lib/apiScenario/gen/testRecordingApiScenarioGenerator";
import { getInputFiles } from "../../lib/util/utils";
import { RestlerApiScenarioGenerator } from "../../lib/apiScenario/gen/restlerApiScenarioGenerator";
import { usePsudorandom } from "../../lib/util/utils";

usePsudorandom.flag = true;

describe("ApiScenarioGenerator", () => {
  it("generate api scenario from recording - storage", async () => {
    const recordingFolder = [
      "test/apiScenario/fixtures/recording/SessionRecords/StorageAccountTests",
    ];
    const specFolders = ["test/apiScenario/fixtures/specification/storage"];

    const recordingPaths = [];
    for (const filePath of recordingFolder) {
      const url = urlParse(filePath);
      if (url) {
        recordingPaths.push(filePath);
      } else {
        const pathStats = fs.statSync(filePath);
        if (pathStats.isDirectory()) {
          const searchPattern = path.join(filePath, "**/*.json");
          const matchedPaths = glob.sync(searchPattern, {
            nodir: true,
          });
          recordingPaths.push(...matchedPaths);
        } else {
          recordingPaths.push(filePath);
        }
      }
    }

    const trackingList = [];
    const recordingLoader = inversifyGetInstance(TestRecordingLoader, {});
    for (const recording of recordingPaths) {
      trackingList.push(await recordingLoader.load(recording));
    }

    const generator = TestRecordingApiScenarioGenerator.create({
      specFolders: specFolders,
      includeARM: true,
    });

    await generator.initialize();

    const apiScenario = await generator.generateTestDefinition(trackingList, ".");

    expect(apiScenario).toMatchSnapshot();
  });

  it("generate api scenario from swagger - storage", async () => {
    const tag = "package-2021-08";
    const readme = "test/apiScenario/fixtures/specification/storage/resource-manager/readme.md";
    const readmeMd: string = path.resolve(readme);
    const swaggerFilePaths = (await getInputFiles(readmeMd, tag)).map((file) =>
      path.join(path.dirname(readmeMd), file)
    );

    const generator = RestlerApiScenarioGenerator.create({
      swaggerFilePaths: swaggerFilePaths,
      outputDir: ".",
      dependencyPath: "test/apiScenario/fixtures/dependency/storage/dependencies.json",
    });

    await generator.initialize();
    const apiScenario = await generator.generate();

    expect(apiScenario).toMatchSnapshot();
  });
});
