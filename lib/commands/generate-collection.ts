// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import * as fs from "fs";
import * as yargs from "yargs";
import { PostmanCollectionGeneratorOption } from "../testScenario/postmanCollectionGenerator";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
export const command = "generate-collection [testScenario-path]";

export const describe = "Generate postman collection file from test scenario.";

export const builder: yargs.CommandBuilder = {
  output: {
    alias: "outputDir",
    describe: "the output folder.",
    string: true,
    default: "generated_collections",
  },
  e: {
    alias: "envFile",
    describe: "the env file path.",
    string: true,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    console.log(JSON.stringify(argv));
    const swaggerFilePaths: string[] = [
      "Microsoft.Storage/stable/2019-06-01/storage.json",
      "Microsoft.Storage/stable/2019-06-01/blob.json",
    ];
    const fileRoot: string =
      "/home/ruowan/work/azure-rest-api-specs/specification/storage/resource-manager";
    let env = {
      subscriptionId: "<mySubcriptionId>",
      location: "westus",
    };
    if (argv.e !== undefined) {
      env = JSON.parse(fs.readFileSync(argv.e).toString());
    }
    const opt: PostmanCollectionGeneratorOption = {
      name: argv.testScenarioPath.replace(/^.*[\\\/]/, "").replace(".yaml", ""),
      testDef: argv.testScenarioPath,
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
    // generate success. print some log.
    return 0;
  });
}
