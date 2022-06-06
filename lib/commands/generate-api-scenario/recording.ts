// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import * as fs from "fs";
import * as path from "path";
import * as yargs from "yargs";
import { glob } from "glob";
import { urlParse } from "@azure-tools/openapi-tools-common";
import { inversifyGetInstance } from "../../inversifyUtils";
import { TestRecordingLoader } from "../../apiScenario/gen/testRecordingLoader";
import { TestRecordingApiScenarioGenerator } from "../../apiScenario/gen/testRecordingApiScenarioGenerator";

export const command = "recording";
export const describe = "Generate api scenario from test proxy records.";

export const builder: yargs.CommandBuilder = {
  recordingPaths: {
    describe: "directory or path of recordings",
    demandOption: true,
    type: "array",
  },
  specsFolders: {
    describe: "spec folders.",
    demandOption: true,
    type: "array",
  },
  output: {
    describe: "path to output test scenario",
    string: true,
    demandOption: true,
    default: "test.yaml",
  },
  includeARM: {
    describe: "include ARM specs",
    boolean: true,
    default: true,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  let output: string = argv.output;
  const recordingPaths = [];
  for (const filePath of argv.recordingPaths) {
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

  console.log("recording-file:");
  console.log(recordingPaths);
  console.log("output-file:");
  console.log(`\t${output}\n`);
  const trackingList = [];
  const recordingLoader = inversifyGetInstance(TestRecordingLoader, {});
  for (const recording of recordingPaths) {
    trackingList.push(await recordingLoader.load(recording));
  }

  const generator = TestRecordingApiScenarioGenerator.create({
    specFolders: argv.specsFolders,
    includeARM: argv.includeARM,
  });

  await generator.initialize();

  await generator.generateTestDefinition(trackingList, output);

  await generator.writeGeneratedFiles();
  process.exit(0);
}
