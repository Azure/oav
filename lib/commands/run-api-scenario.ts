// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as fs from "fs";
import * as path from "path";
import * as yargs from "yargs";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import {
  PostmanCollectionGenerator,
  PostmanCollectionGeneratorOption,
} from "../apiScenario/postmanCollectionGenerator";
import { inversifyGetInstance } from "../inversifyUtils";
import { printWarning } from "../util/utils";
import { getSwaggerFilePathsFromApiScenarioFilePath } from "../apiScenario/apiScenarioYamlLoader";
import { getSwaggerListFromReadme } from "../util/readmeUtils";

export const command = "run-api-scenario <api-scenario>";

export const aliases = ["run"];

export const describe = "newman runner run API scenario file.";

export const apiScenarioEnvKey = "API_SCENARIO_JSON_ENV";

/**
 * UploadBlob true. Upload generated file and result to azure blob storage. connection string is passed by `process.env.blobConnectionString`
 * Upload files:
 *
 * 1. newmanReport: containerName: newmanreport path: <ResourceProvider>/<apiVersion>/<apiScenarioFileName>/<runId>/<scenarioIdx>.json
 *
 * 2. payload: containerName: payload path: <resourceProvider>/<apiVersion>/<apiScenarioFileName>/<runId>/<scenarioIdx>/<correlationId>.json
 *
 * 3. report: containerName: report path: <ResourceProvider>/<apiVersion>/<apiScenarioFileName>/<runId>/<scenarioIdx>/report.json
 *
 * 4. postmancollection & postmanenv: container: postmancollection: <ResourceProvider>/<apiVersion>/<apiScenarioFileName>/<runId>/<scenarioIdx>/collection.json
 * postmanenv: <ResourceProvider>/<apiVersion>/<apiScenarioFileName>/<runId>/<scenarioIdx>/env.json
 *
 */
export const builder: yargs.CommandBuilder = {
  e: {
    alias: "envFile",
    describe: "the env file path.",
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
  skipCleanUp: {
    describe: "whether delete resource group when all steps finished",
    boolean: true,
  },
  dryRun: {
    describe: "dry run mode. only create postman collection file not run live api test.",
    boolean: true,
    default: false,
  },
  from: {
    describe:
      "the step to start with in current run, it's used for debugging and make sure use --skipCleanUp to not delete resource group in the previous run.",
    string: true,
    demandOption: false,
    implies: "runId",
  },
  to: {
    describe:
      "the step to end in current run,it's used for debugging and make sure use --skipCleanUp to not delete resource group in the previous run.",
    string: true,
    demandOption: false,
    implies: "runId",
  },
  runId: {
    describe: "specify the runId for debugging",
    string: true,
    demandOption: false,
  },
  verbose: {
    describe: "log verbose",
    default: false,
    boolean: true,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const swaggerFilePaths: string[] = argv.specs || [];
    if (argv.readme !== undefined) {
      const inputSwaggerFile = await getSwaggerListFromReadme(argv.readme, argv.tag);
      for (const it of inputSwaggerFile) {
        if (swaggerFilePaths.indexOf(it) === -1) {
          swaggerFilePaths.push(it);
        }
      }
    }

    const scenarioFilePath = argv.apiScenario;
    if (swaggerFilePaths.length === 0) {
      swaggerFilePaths.push(...getSwaggerFilePathsFromApiScenarioFilePath(scenarioFilePath));
    }

    console.log("input-file:");
    console.log(swaggerFilePaths);

    let env: any = {};
    if (argv.e !== undefined) {
      env = JSON.parse(fs.readFileSync(argv.e).toString());
    }
    if (process.env[apiScenarioEnvKey]) {
      const envFromVariable = JSON.parse(process.env[apiScenarioEnvKey] as string);
      for (const key of Object.keys(envFromVariable)) {
        if (env[key] !== undefined && envFromVariable[key] !== env[key]) {
          printWarning(
            `Notice: the variable '${key}' in '${argv.e}' is overwritten by the variable in the environment '${apiScenarioEnvKey}'.`
          );
        }
      }
      env = { ...env, ...envFromVariable };
    }
    // fileRoot is the nearest common root of all swagger file paths
    const fileRoot = path.dirname(scenarioFilePath);
    if (argv.location !== undefined) {
      env.location = argv.location;
    }
    if (argv.subscriptionId !== undefined) {
      env.subscriptionId = argv.subscriptionId;
    }
    if (argv.resourceGroup !== undefined) {
      env.resourceGroupName = argv.resourceGroup;
    }

    console.log(`fileRoot: ${fileRoot}`);
    const opt: PostmanCollectionGeneratorOption = {
      name: path.basename(scenarioFilePath),
      scenarioDef: scenarioFilePath,
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
      skipCleanUp: argv.skipCleanUp,
      from: argv.from,
      to: argv.to,
      runId: argv.runId,
      verbose: argv.verbose,
      swaggerFilePaths: swaggerFilePaths,
    };
    const generator = inversifyGetInstance(PostmanCollectionGenerator, opt);
    await generator.GenerateCollection();
    return 0;
  });
}
