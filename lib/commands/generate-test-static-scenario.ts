// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import { dirname, resolve as pathResolve } from "path";
import * as yargs from "yargs";
import { getAutorestConfig } from "../util/getAutorestConfig";
import { StaticTestScenarioGenerator } from "./../testScenario/gen/staticTestScenarioGenerator";

export const command = "generate-static-test-scenario";
export const describe = "Generate test-scenario from swagger.";

export const builder: yargs.CommandBuilder = {
  tag: {
    describe: "the readme tag name.",
    string: true,
  },
  readme: {
    describe: "path to readme.md file",
    string: true,
    demandOption: true,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  const readmeMd: string = argv.readme;

  const autorestConfig = await getAutorestConfig(argv, readmeMd);
  const fileRoot = dirname(readmeMd);
  const swaggerFilePaths: string[] = autorestConfig["input-file"].map((it: string) =>
    pathResolve(fileRoot, it)
  );

  console.log("input-file:");
  console.log(swaggerFilePaths);

  const generator = StaticTestScenarioGenerator.create({
    swaggerFilePaths: swaggerFilePaths,
    tag: autorestConfig.tag,
  });

  await generator.initialize();

  await generator.generateTestDefFiles();

  await generator.writeGeneratedFiles();
  process.exit(0);
}
