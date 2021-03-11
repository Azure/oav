import globby from "globby";
import "reflect-metadata";
import { inversifyGetInstance } from "../inversifyUtils";
import { TestRecordingLoader } from "./gen/testRecordingLoader";

import { RequestTracking, TestScenarioGenerator } from "./gen/testScenarioGenerator";

const main = async () => {
  const swaggerFilePaths = await globby(
    "/home/htc/azure-rest-api-specs/specification/containerservice/resource-manager/Microsoft.ContainerService/stable/*/*.json"
    // "/home/htc/azure-rest-api-specs/specification/network/resource-manager/Microsoft.Network/stable/*/*.json"
  );
  // console.log(swaggerFilePaths);
  const generator = TestScenarioGenerator.create({
    useJsonParser: false,
    checkUnderFileRoot: false,
    // fileRoot: "/home/htc/azure-rest-api-specs/specification/network/resource-manager",
    fileRoot: "/home/htc/azure-rest-api-specs/specification/containerservice/resource-manager",
    swaggerFilePaths,
  });

  await generator.initialize();

  const recordingLoader = inversifyGetInstance(TestRecordingLoader, {});
  const fileList = await globby(
    // "/home/htc/azure-cli/src/azure-cli/azure/cli/command_modules/network/tests/latest/recordings/test_network_public_ip.yaml"
    "/mnt/c/dev/azure-powershell/src/Aks/Aks.Test/SessionRecords/*/*.json"
  );
  const trackingList: RequestTracking[] = [];
  for (const filePath of fileList) {
    // console.log(filePath);
    const tracking = await recordingLoader.load(filePath);
    trackingList.push(tracking);
  }
  await generator.generateTestDefinition(
    trackingList,
    // "Microsoft.Network/stable/2020-08-01/test-scenarios/testNetworkPublicIp.yaml"
    "Microsoft.ContainerService/stable/2020-08-01/test-scenarios/testAks.yaml"
  );

  await generator.writeGeneratedFiles();
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main().catch((e) => {
  console.error(e);
});
