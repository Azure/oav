// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import * as fs from "fs";
import * as path from "path";
import * as yargs from "yargs";
import {
  PostmanCollectionGenerator,
  PostmanCollectionGeneratorOption,
} from "../testScenario/postmanCollectionGenerator";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { getAutorestConfig } from "../util/getAutorestConfig";
import { inversifyGetInstance } from "./../inversifyUtils";
export const command = "generate-collection";

export const describe = "Generate postman collection file from test scenario.";

export const builder: yargs.CommandBuilder = {
  tag: {
    describe: "the readme tag name.",
    string: true,
  },
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
  uploadBlob: {
    describe: "upload generated collection to blob.",
    boolean: true,
    default: false,
  },
  armEndpoint: {
    describe: "ARM endpoint",
    string: true,
    default: "https://management.azure.com",
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const readmeMd: string = argv.readme;
    argv["try-require"] = "readme.test.md";
    const autorestConfig = await getAutorestConfig(argv, readmeMd);
    console.log(autorestConfig["input-file"]);
    console.log(autorestConfig["test-resources"]);
    if (autorestConfig["test-resources"] === undefined) {
      throw new Error(`No test-scenario file found in '${argv.tag || "default"}'`);
    }
    const fileRoot: string = path.dirname(readmeMd);
    const swaggerFilePaths: string[] = autorestConfig["input-file"].map((it: string) =>
      path.resolve(fileRoot, it)
    );
    for (const testResources of autorestConfig["test-resources"]) {
      const testScenarioFilePath = testResources.test;
      let env = {
        subscriptionId: "<mySubcriptionId>",
        location: "westus",
      };
      if (argv.e !== undefined) {
        env = JSON.parse(fs.readFileSync(argv.e).toString());
      }
      console.log(
        `generating postman collection from ${testScenarioFilePath}. outputDir: ${argv.output}`
      );
      const opt: PostmanCollectionGeneratorOption = {
        name: testScenarioFilePath.replace(/^.*[\\\/]/, "").replace(".yaml", ""),
        testDef: testScenarioFilePath,
        swaggerFilePaths: swaggerFilePaths,
        fileRoot: fileRoot,
        checkUnderFileRoot: true,
        useJsonParser: false,
        runCollection: false,
        generateCollection: true,
        env: env,
        outputFolder: argv.output,
        markdownReportPath: argv.markdownReportPath,
        eraseXmsExamples: false,
        eraseDescription: false,
        enableBlobUploader: false,
        blobConnectionString: process.env.blobConnectionString || "",
        baseUrl: argv.armEndpoint,
      };
      if (!fs.existsSync(argv.output)) {
        fs.mkdirSync(argv.output);
      }
      const generator = inversifyGetInstance(PostmanCollectionGenerator, opt);
      await generator.GenerateCollection();
    }
    return 0;
  });
}
