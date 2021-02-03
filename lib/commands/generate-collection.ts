// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import * as fs from "fs";
import * as yargs from "yargs";
import {
  PostmanCollectionGenerator,
  PostmanCollectionGeneratorOption,
} from "../testScenario/postmanCollectionGenerator";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { getAutorestConfig } from "../util/getAutorestConfig";
export const command = "generate-collection [testScenario-path]";

export const describe = "Generate postman collection file from test scenario.";

export const builder: yargs.CommandBuilder = {
  output: {
    alias: "outputDir",
    describe: "the output folder.",
    string: true,
    default: "generated_collections",
  },
  readme: {
    describe: "path to readme.md file",
    string: true,
    demandOption: true,
  },
  e: {
    alias: "envFile",
    describe: "the env file path.",
    string: true,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const readmeMd: string = argv.readme;
    argv["try-require"] = "readme.test.md"
    const autorestConfig = await getAutorestConfig(argv, readmeMd);
    console.log(autorestConfig["input-file"])
    console.log(autorestConfig["test-resources"])
    const swaggerFilePaths: string[] = autorestConfig["input-file"]
    const testScenarioFile = autorestConfig["test-resources"][0]["test"]
    console.log(testScenarioFile)
    const fileRoot: string =
      "/home/codespace/workspace/azure-rest-api-specs/specification/containerservice/resource-manager";
    let env = {
      subscriptionId: "<mySubcriptionId>",
      location: "westus",
    };
    if (argv.e !== undefined) {
      env = JSON.parse(fs.readFileSync(argv.e).toString());
    }
    console.log(
      `generating postman collection from ${testScenarioFile}. outputDir: ${argv.output}`
    );
    const opt: PostmanCollectionGeneratorOption = {
      name: testScenarioFile.replace(/^.*[\\\/]/, "").replace(".yaml", ""),
      testDef: testScenarioFile,
      swaggerFilePaths: swaggerFilePaths,
      fileRoot: fileRoot,
      env: env,
      outputFolder: argv.output,
    };
    if (!fs.existsSync(argv.output)) {
      fs.mkdirSync(argv.output);
    }
    const generator = new PostmanCollectionGenerator(opt);
    await generator.GenerateCollection();
    console.log(`succeed`);
    return 0;
  });
}
