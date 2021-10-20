// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import { dirname, resolve as pathResolve } from "path";
import * as yargs from "yargs";
import { getAutorestConfig } from "../util/getAutorestConfig";
import { StaticApiScenarioGenerator } from "../apiScenario/gen/staticTestScenarioGenerator";

export const command = "generate-static-api-scenario";
export const describe = "Generate test-scenario from swagger.";

export const builder: yargs.CommandBuilder = {
  tag: {
    describe: "the readme tag name.",
    string: true,
  },
  readme: {
    describe: "path to readme.md file",
    string: true,
  },
  swaggers: {
    describe: "one or more swagger file paths. type: array",
    type: "array",
  },
  rules: {
    describe:
      "generate test scenarios file rules split by comma. supported: operations-list , put-delete.",
    string: true,
    default: "resource-put-delete",
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  const readmeMd: string = pathResolve(argv.readme);
  const swaggerFiles = argv.swaggers;
  console.log(swaggerFiles);

  const autorestConfig = await getAutorestConfig(argv, readmeMd);
  const fileRoot = dirname(readmeMd);
  const swaggerFilePaths: string[] = autorestConfig["input-file"].map((it: string) =>
    pathResolve(fileRoot, it)
  );

  console.log("input-file:");
  console.log(swaggerFilePaths);

  const generator = StaticApiScenarioGenerator.create({
    swaggerFilePaths: swaggerFilePaths,
    tag: autorestConfig.tag,
    rules: argv.rules.split(","),
  });

  await generator.initialize();

  await generator.generateTestDefFiles();

  await generator.writeGeneratedFiles();
  process.exit(0);
}
