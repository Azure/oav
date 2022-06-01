import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { urlParse } from "@azure-tools/openapi-tools-common";
import { TestRecordingLoader } from "../../lib/apiScenario/gen/testRecordingLoader";
import { inversifyGetInstance } from "../../lib/inversifyUtils";
import { TestScenarioGenerator } from "../../lib/apiScenario/gen/testScenarioGenerator";

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

    const generator = TestScenarioGenerator.create({
      specFolders: specFolders,
    });

    await generator.initialize();

    const apiScenario = await generator.generateTestDefinition(trackingList, ".");

    expect(apiScenario).toMatchSnapshot();
  });
});
