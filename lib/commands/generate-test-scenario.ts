// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import globby from "globby";
import { dirname } from "path";
import * as yargs from "yargs";
import { inversifyGetInstance } from "../inversifyUtils";
import { TestRecordingLoader } from "../testScenario/gen/testRecordingLoader";
import { RequestTracking, TestScenarioGenerator } from "../testScenario/gen/testScenarioGenerator";
import { getAutorestConfig } from "../util/getAutorestConfig";

export const command = "generate-test-scenario";

export const describe = "Generate swagger examples from real payload records.";

export const builder: yargs.CommandBuilder = {
  tag: {
    describe: "the readme tag name.",
    string: true,
  },
  recording: {
    describe:
      "path glob pattern for recording files. Supported format: DotNet recording, Azure Powershell recording, Azure Cli recording",
    string: true,
    demandOption: true,
  },
  readme: {
    describe: "path to readme.md file",
    string: true,
    demandOption: true,
  },
  output: {
    describe: "path to output test scenario",
    string: true,
    demandOption: true,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  const readmeMd: string = argv.readme;
  const output: string = argv.output;
  const recording: string = argv.recording;
  argv["try-require"] = "readme.test.md";

  const recordingFilePaths = await globby(recording);
  const autorestConfig = await getAutorestConfig(argv, readmeMd);
  const swaggerFilePaths: string[] = autorestConfig["input-file"];
  console.log("input-file:");
  console.log();
  console.log("recording-file:");
  console.log(recordingFilePaths);
  console.log("output-file:");
  console.log(`\t${output}\n`);

  const generator = TestScenarioGenerator.create({
    useJsonParser: false,
    checkUnderFileRoot: false,
    fileRoot: dirname(readmeMd),
    swaggerFilePaths,
  });

  await generator.initialize();

  const recordingLoader = inversifyGetInstance(TestRecordingLoader, {});
  const trackingList: RequestTracking[] = [];
  for (const filePath of recordingFilePaths) {
    // console.log(filePath);
    const tracking = await recordingLoader.load(filePath);
    trackingList.push(tracking);
  }
  await generator.generateTestDefinition(trackingList, output);

  await generator.writeGeneratedFiles();
}
