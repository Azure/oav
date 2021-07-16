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

export const aliases = ["run"];

export const describe = "newman runner run test scenario file.";

export const testScenarioEnvKey = "TEST_SCENARIO_JSON_ENV";

/**
 * UploadBlob true. Upload generated file and result to azure blob storage. connection string is passed by `process.env.blobConnectionString`
 * Upload files:
 *
 * 1. newmanReport: containerName: newmanreport path: <ResourceProvider>/<apiVersion>/<testScenarioFileName>/<runId>/<testScenarioIdx>.json
 *
 * 2. payload: containerName: payload path: <resourceProvider>/<apiVersion>/<testScenarioFileName>/<runId>/<testScenarioIdx>/<correlationId>.json
 *
 * 3. report: containerName: report path: <ResourceProvider>/<apiVersion>/<testScenarioFileName>/<runId>/<testScenarioIdx>/report.json
 *
 * 4. postmancollection & postmanenv: container: postmancollection: <ResourceProvider>/<apiVersion>/<testScenarioFileName>/<runId>/<testScenarioIdx>/collection.json
 * postmanenv: <ResourceProvider>/<apiVersion>/<testScenarioFileName>/<runId>/<testScenarioIdx>/env.json
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
    describe: "result output folder.",
    string: true,
    default: "generated",
  },
  markdown: {
    alias: "markdownReportPath",
    describe: "markdown report output path.",
    string: true,
  },
  junit: {
    alias: "junitReportPath",
    describe: "junit report output path.",
    string: true,
  },
  uploadBlob: {
    describe: "upload generated collection to blob.",
    boolean: true,
    default: false,
  },
  level: {
    describe:
      "validation level. oav runner validate request and response with different strict level. 'validate-request' only validate request should return 2xx status code. 'validate-request-response' validate both request and response.",
    string: true,
    default: "validate-request-response",
  },
  armEndpoint: {
    describe: "ARM endpoint",
    string: true,
    default: "https://management.azure.com",
  },
  location: {
    describe: "resource provision location parameter",
    string: true,
  },
  subscriptionId: {
    describe: "subscriptionId to run API test",
    string: true,
  },
  resourceGroup: {
    describe: "resource group",
    string: true,
  },
  cleanUp: {
    describe: "whether delete resource group when all steps finished",
    boolean: true,
    default: true,
  },
  dryRun: {
    describe: "dry run mode. only create postman collection file not run live api test.",
    boolean: true,
    default: false,
  },
  from: {
    describe:
      "the step to start with in current run, it's used for debugging and the resource group will not be deleted",
    string: true,
    demandOption: false,
    implies: "runId",
  },
  to: {
    describe:
      "the step to end in current run,it's used for debugging and the resource group will not be deleted",
    string: true,
    demandOption: false,
    implies: "runId",
  },
  runId: {
    describe: "specify the last runId for debugging",
    string: true,
    demandOption: false,
  },
  ci: {
    describe: "specify if it's in a CI pipeline",
    boolean: true,
    default: false,
    demandOption: false,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const testScenarioFilePath = path.resolve(argv.testScenario);
    const swaggerFilePaths = getSwaggerFilePathsFromTestScenarioFilePath(testScenarioFilePath);
    if (swaggerFilePaths.length === 0) {
      throw new Error(
        `Run test scenario failed. can not find related swagger file. ${testScenarioFilePath}`
      );
    }
    let env: any = {};
    if (argv.e !== undefined) {
      env = JSON.parse(fs.readFileSync(argv.e).toString());
    }
    else if (process.env[testScenarioEnvKey]) {
      env = JSON.parse(process.env[testScenarioEnvKey] as string);
    }
    // fileRoot is the nearest common root of all swagger file paths
    const fileRoot = path.dirname(swaggerFilePaths[0]);
    const resourceProvider = getProviderFromFilePath(testScenarioFilePath);
    const apiVersion = getApiVersionFromSwaggerFile(swaggerFilePaths[0]);
    if (argv.location !== undefined) {
      env.location = argv.location;
    }
    if (argv.subscriptionId !== undefined) {
      env.subscriptionId = argv.subscriptionId;
    }

    if (argv.resourceGroup !== undefined) {
      env.resourceGroupName = argv.resourceGroup;
    }
    const opt: PostmanCollectionGeneratorOption = {
      name: `${resourceProvider}/${apiVersion}/${getFileNameFromPath(testScenarioFilePath)}`,
      testDef: testScenarioFilePath,
      swaggerFilePaths: swaggerFilePaths,
      fileRoot: fileRoot,
      checkUnderFileRoot: false,
      generateCollection: true,
      useJsonParser: false,
      runCollection: !argv.dryRun,
      env: env,
      outputFolder: argv.output,
      markdownReportPath: argv.markdownReportPath,
      junitReportPath: argv.junitReportPath,
      eraseXmsExamples: false,
      eraseDescription: false,
      enableBlobUploader: argv.uploadBlob,
      blobConnectionString: process.env.blobConnectionString || "",
      baseUrl: argv.armEndpoint,
      validationLevel: argv.level,
      cleanUp: argv.cleanUp,
      from: argv.from,
      to: argv.to,
      runId:argv.runId,
      ci:argv.ci
    };
    const generator = inversifyGetInstance(PostmanCollectionGenerator, opt);
    await generator.GenerateCollection();
    return 0;
  });
}
