// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as fs from "fs";
import * as path from "path";
import * as yargs from "yargs";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import {
  PostmanCollectionGenerator,
  PostmanCollectionGeneratorOption,
} from "../testScenario/postmanCollectionGenerator";
import { inversifyGetInstance } from "../inversifyUtils";
import { getSwaggerFilePathsFromTestScenarioFilePath } from "./../testScenario/testResourceLoader";

export const command = "run-test-scenario <test-scenario>";

export const describe = "analyze swagger resource type dependency.";

export const builder: yargs.CommandBuilder = {
  e: {
    alias: "envFile",
    describe: "the env file path.",
    string: true,
  },
  output: {
    alias: "outputDir",
    describe: "the output folder.",
    string: true,
    default: "generated_collections",
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const testScenarioFilePath = argv.testScenario;
    const swaggerFilePaths = getSwaggerFilePathsFromTestScenarioFilePath(testScenarioFilePath);
    if (swaggerFilePaths.length === 0) {
      throw new Error(
        `Run test scenario failed. can not find related swagger file. ${testScenarioFilePath}`
      );
    }
    let env = {};
    if (argv.e !== undefined) {
      env = JSON.parse(fs.readFileSync(argv.e).toString());
    }
    // fileRoot is the nearest common root of all swagger file paths
    const fileRoot = path.dirname(swaggerFilePaths[0]);
    const opt: PostmanCollectionGeneratorOption = {
      name: testScenarioFilePath.replace(/^.*[\\\/]/, "").replace(".yaml", ""),
      testDef: testScenarioFilePath,
      swaggerFilePaths: swaggerFilePaths,
      fileRoot: fileRoot,
      checkUnderFileRoot: false,
      generateCollection: false,
      useJsonParser: false,
      runCollection: true,
      env: env,
      outputFolder: argv.output,
      eraseXmsExamples: false,
      eraseDescription: false,
    };
    const generator = inversifyGetInstance(PostmanCollectionGenerator, opt);
    await generator.GenerateCollection();
    return 0;
  });
}
