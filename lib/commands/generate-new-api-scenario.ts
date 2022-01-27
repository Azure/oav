// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */
import * as yargs from "yargs";
import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { ApiScenarioGenerator } from "../apiScenario/gen/apiScenarioGenerator";

export const command = "generate-new-api-scenario";

export const describe = "Generates an api scenario of the given swagger spec.";

export const builder: yargs.CommandBuilder = {
  d: {
    alias: "outputDir",
    describe: "Output directory where the api scenario will be stored.",
    string: true,
    default: "./",
  },
  swaggers: {
    describe: "one or more swagger file paths. type: array",
    type: "array",
  },
  i: {
    alias: "dependency",
    describe: "The file path of the swagger dependency.",
    string: true,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const generator = ApiScenarioGenerator.create({
      swaggerFilePaths: argv.swaggers,
      outputDir: argv.outputDir,
      dependencyPath: argv.dependency,
    });

    await generator.initialize();
    await generator.generate();
    return 0;
  });
}
