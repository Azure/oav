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
import { getApiVersionFromSwaggerFile, getProviderFromFilePath } from "../util/utils";
import { getFileNameFromPath } from "../testScenario/defaultNaming";
import { getSwaggerFilePathsFromTestScenarioFilePath } from "./../testScenario/testResourceLoader";

export const command = "run-test-scenario <test-scenario>";

export const describe = "newman runner run test scenario file.";

/**
 * UploadBlob true. Upload generated file and result to azure blob storage. connection string is passed by `process.env.blobConnectionString`
 * Upload files:
 *
 * 1. newmanReport: containerName: newmanreport path: <ResourceProvider>/<apiVersion>/<testScenarioFileName>/<testScenarioIdx>/<runId>.json
 * E.g path: Microsoft.AppConfiguration/2020-07-01-preview/configurationStores/0/202104260219-42d2v.json
 *
 * 2. payload: containerName: payload path: <resourceProvider>/<apiVersion>/<testScenarioFileName>/<testScenarioIdx>/<correlationId>.json
 * E.g path: Microsoft.AppConfiguration/2020-07-01-preview/configurationStores/0/516d0a63-4a46-491e-b11c-6bd64ca79999.json
 *
 * 3. report: containerName: report path: <ResourceProvider>/<apiVersion>/<testScenarioFileName>/<testScenarioIdx>/<runId>/report.json
 * e.g path: Microsoft.AppConfiguration/2020-07-01-preview/configurationStores/0/202104260219-42d2v/report.json
 *
 * 4. postmancollection & postmanenv: container: postmancollection: <ResourceProvider>/<apiVersion>/<testScenarioFileName>/<testScenarioIdx>/<runId>/collection.json
 * postmanenv: <ResourceProvider>/<apiVersion>/<testScenarioFileName>/<testScenarioIdx>/<runId>/env.json
 * e.g path: Microsoft.AppConfiguration/2020-07-01-preview/configurationStores/0/202104260219-42d2v/collection.json
 *
 */
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
    default: "generated",
  },
  uploadBlob: {
    describe: "upload generated collection to blob.",
    boolean: true,
    default: false,
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
    const resourceProvider = getProviderFromFilePath(testScenarioFilePath);
    const apiVersion = getApiVersionFromSwaggerFile(swaggerFilePaths[0]);
    const opt: PostmanCollectionGeneratorOption = {
      name: `${resourceProvider}/${apiVersion}/${getFileNameFromPath(testScenarioFilePath)}`,
      testDef: testScenarioFilePath,
      swaggerFilePaths: swaggerFilePaths,
      fileRoot: fileRoot,
      checkUnderFileRoot: false,
      generateCollection: true,
      useJsonParser: false,
      runCollection: true,
      env: env,
      outputFolder: argv.output,
      eraseXmsExamples: false,
      eraseDescription: false,
      enableBlobUploader: argv.uploadBlob,
      blobConnectionString: process.env.blobConnectionString || "",
    };
    const generator = inversifyGetInstance(PostmanCollectionGenerator, opt);
    await generator.GenerateCollection();
    return 0;
  });
}
