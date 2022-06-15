// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import { resolve as pathResolve } from "path";
import * as yargs from "yargs";
import { StaticApiScenarioGenerator } from "../../apiScenario/gen/staticApiScenarioGenerator";
import { RestlerApiScenarioGenerator } from "../../apiScenario/gen/restlerApiScenarioGenerator";
import { cliSuppressExceptions } from "../../cliSuppressExceptions";
import { getInputFiles } from "../../util/utils";

export const command = "static";
export const describe = "Generate api-scenario from specs.";

export const builder: yargs.CommandBuilder = {
  o: {
    alias: "outputDir",
    describe: "Output directory where the api scenario will be stored.",
    string: true,
    default: "./",
  },
  dependency: {
    describe: "The file path of the RESTler dependency.",
    string: true,
  },
  tag: {
    describe: "the readme tag name.",
    string: true,
  },
  readme: {
    describe: "path to readme.md file",
    string: true,
  },
  specs: {
    describe: "one or more spec file paths. type: array",
    type: "array",
  },
  rules: {
    describe:
      "generate api scenarios file rules split by comma. supported: operations-list , put-delete.",
    string: true,
    default: "resource-put-delete",
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const swaggerFilePaths: string[] = (argv.specs || []).map((it: string) => pathResolve(it));
    let tag = "default";
    if (argv.readme !== undefined) {
      const readmeMd: string = pathResolve(argv.readme);
      const inputSwaggerFile = await getInputFiles(readmeMd, argv.tag);
      console.log(`input swagger files: ${inputSwaggerFile}`);
      for (const it of inputSwaggerFile) {
        if (swaggerFilePaths.indexOf(it) === -1) {
          swaggerFilePaths.push(it);
        }
      }
    }

    console.log("input-file:");
    console.log(swaggerFilePaths);

    if (argv.dependency) {
      const generator = RestlerApiScenarioGenerator.create({
        swaggerFilePaths: swaggerFilePaths,
        outputDir: argv.outputDir,
        dependencyPath: argv.dependency,
      });

      await generator.initialize();
      await generator.generate();
    } else {
      const generator = StaticApiScenarioGenerator.create({
        swaggerFilePaths: swaggerFilePaths,
        tag: tag,
        rules: argv.rules.split(","),
      });

      await generator.initialize();

      await generator.generateTestDefFiles();

      await generator.writeGeneratedFiles();
    }
    return 0;
  });
}
