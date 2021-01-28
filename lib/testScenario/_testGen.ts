import "reflect-metadata";
import { inversifyGetInstance } from "../inversifyUtils";
import { TestRecordingLoader } from "./gen/testRecordingLoader";

import { TestScenarioGenerator } from "./gen/testScenarioGenerator";

const main = async () => {
  const generator = TestScenarioGenerator.create({
    useJsonParser: false,
    checkUnderFileRoot: false,
    fileRoot: "/home/htc/azure-rest-api-specs/specification/containerservice/resource-manager",
    swaggerFilePaths: [
      "Microsoft.ContainerService/stable/2019-08-01/location.json",
      "Microsoft.ContainerService/stable/2019-08-01/managedClusters.json",
    ],
  });

  await generator.initialize();

  const recordingLoader = inversifyGetInstance(TestRecordingLoader, {});
  const tracking = await recordingLoader.load(
    "/mnt/c/dev/azure-powershell/src/Aks/Aks.Test/SessionRecords/Commands.Aks.Test.ScenarioTests.GetAksVersionTests/TestAksVersion.json"
  );
  const testDef = await generator.generateTestDefinition(
    [tracking],
    "/Microsoft.ContainerService/stable/2019-08-01/test-scenarios/testAksVersion.yaml"
  );

  console.log(JSON.stringify(testDef, undefined, 2));

  await generator.writeGeneratedFiles();
};

// eslint-disable-next-line @typescript-eslint/no-floating-promises
main();
