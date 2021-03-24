import "reflect-metadata";
import { basename, dirname } from "path";
import globby from "globby";
import { inversifyGetInstance } from "../inversifyUtils";
import { getAutorestConfig } from "../util/getAutorestConfig";
import { TestRecordingLoader } from "./gen/testRecordingLoader";
import { RequestTracking, TestScenarioGenerator } from "./gen/testScenarioGenerator";

const main = async () => {
  const readmeMd: string =
    // "/home/htc/azure-rest-api-specs/specification/containerservice/resource-manager/readme.md";
    "/home/htc/azure-rest-api-specs/specification/network/resource-manager/readme.md";
  // "/home/htc/azure-rest-api-specs/specification/operationalinsights/resource-manager/readme.md";
  const argv = {
    ["try-require"]: "readme.test.md",
    tag: "package-2020-08",
  };

  const autorestConfig = await getAutorestConfig(argv, readmeMd);
  const swaggerFilePaths: string[] = autorestConfig["input-file"];
  const fileRoot = dirname(readmeMd);
  const generator = TestScenarioGenerator.create({
    useJsonParser: false,
    checkUnderFileRoot: false,
    fileRoot,
    swaggerFilePaths,
  });

  await generator.initialize();

  const recordingLoader = inversifyGetInstance(TestRecordingLoader, {});
  const fileList = await globby(
    "/home/htc/azure-cli/src/azure-cli/azure/cli/command_modules/network/tests/latest/recordings/*.yaml"
    // "/mnt/c/dev/azure-powershell/src/Aks/Aks.Test/SessionRecords/*/*.json"
  );

  for (const filePath of fileList) {
    // console.log(filePath);
    try {
      const tracking = await recordingLoader.load(filePath);
      const trackingList: RequestTracking[] = [];
      trackingList.push(tracking);

      await generator.generateTestDefinition(
        trackingList,
        `Microsoft.Network/stable/2020-08-01/test-scenarios/${basename(filePath)}`
        // "Microsoft.ContainerService/stable/2020-08-01/test-scenarios/testAks.yaml"
      );
    } catch (e) {
      console.log(filePath);
      console.error(e);
      continue;
    }
  }

  await generator.writeGeneratedFiles();
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((e) => {
  console.error(e);
});
