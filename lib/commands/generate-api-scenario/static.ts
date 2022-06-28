// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import { resolve as pathResolve, dirname, join as pathJoin } from "path";
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
    describe: "generate api scenarios file rules split by comma. supported: operations-list.",
    string: true,
    default: "operations-list",
  },
  useExample: {
    describe: "use example in the spec file.",
    boolean: true,
    default: false,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const swaggerFilePaths: string[] = (argv.specs || []).map((it: string) => pathResolve(it));
    let tag = "default";
    let fileRoot = process.cwd();

    if (argv.readme !== undefined) {
      const readmeMd: string = pathResolve(argv.readme);
      fileRoot = dirname(readmeMd);
      const inputSwaggerFile = (await getInputFiles(readmeMd, argv.tag)).map((it: string) =>
        pathJoin(fileRoot, it)
      );
      console.log(`input swagger files: ${inputSwaggerFile}`);
      for (const it of inputSwaggerFile) {
        if (swaggerFilePaths.indexOf(it) === -1) {
          swaggerFilePaths.push(it);
        }
      }
    }

    console.log(`fileRoot: ${fileRoot}`);
    console.log("input-file:");
    console.log(swaggerFilePaths);

    if (argv.dependency) {
      const generator = RestlerApiScenarioGenerator.create({
        fileRoot: fileRoot,
        checkUnderFileRoot: false,
        swaggerFilePaths: swaggerFilePaths,
        outputDir: pathResolve(argv.outputDir),
        dependencyPath: pathResolve(argv.dependency),
        useExample: argv.useExample,
      });

      await generator.initialize();
      const def = await generator.generate();
      await generator.writeFile(def);
    } else {
      const generator = StaticApiScenarioGenerator.create({
        swaggerFilePaths: swaggerFilePaths,
        tag: tag,
        rules: argv.rules.split(","),
      });

      await generator.generateTestDefFiles();

      await generator.writeGeneratedFiles();
    }
    return 0;
  });
}
