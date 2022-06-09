// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as fs from "fs";
import * as path from "path";
import { pathDirName, pathJoin, pathResolve } from "@azure-tools/openapi-tools-common";
import { findReadMe } from "@azure/openapi-markdown";
import * as yargs from "yargs";
import {
  PostmanCollectionGenerator,
  PostmanCollectionGeneratorOption,
} from "../apiScenario/postmanCollectionGenerator";
import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { inversifyGetInstance } from "../inversifyUtils";
import { getInputFiles, printWarning } from "../util/utils";
import { EnvironmentVariables } from "../apiScenario/variableEnv";

export const command = "run-api-scenario <api-scenario>";

export const aliases = ["run"];

export const describe = "newman runner run API scenario file.";

export const apiScenarioEnvKey = "API_SCENARIO_JSON_ENV";

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
  testProxy: {
    describe: "TestProxy endpoint, e.g., http://localhost:5000. If not set, no proxy will be used.",
    string: true,
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
  verbose: {
    describe: "log verbose",
    default: false,
    boolean: true,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const scenarioFilePath = pathResolve(argv.apiScenario);
    const readmePath = argv.readme
      ? pathResolve(argv.readme)
      : await findReadMe(pathDirName(scenarioFilePath));

    const fileRoot = readmePath ? pathDirName(readmePath) : process.cwd();
    console.log(`fileRoot: ${fileRoot}`);

    const swaggerFilePaths: string[] = argv.specs || [];
    if (readmePath && argv.tag !== undefined) {
      const inputSwaggerFile = await getInputFiles(readmePath, argv.tag);
      if (inputSwaggerFile) {
        for (const it of inputSwaggerFile) {
          if (swaggerFilePaths.indexOf(it) === -1) {
            swaggerFilePaths.push(pathJoin(fileRoot, it));
          }
        }
      }
    }

    console.log("input-file:");
    console.log(swaggerFilePaths);

    let env: EnvironmentVariables = {};
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
      name: path.basename(scenarioFilePath),
      scenarioDef: scenarioFilePath,
      fileRoot: fileRoot,
      checkUnderFileRoot: false,
      generateCollection: true,
      useJsonParser: false,
      runCollection: !argv.dryRun,
      env,
      outputFolder: argv.output,
      markdownReportPath: argv.markdownReportPath,
      junitReportPath: argv.junitReportPath,
      eraseXmsExamples: false,
      eraseDescription: false,
      baseUrl: argv.armEndpoint,
      testProxy: argv.testProxy,
      validationLevel: argv.level,
      skipCleanUp: argv.skipCleanUp,
      verbose: argv.verbose,
      swaggerFilePaths: swaggerFilePaths,
    };
    const generator = inversifyGetInstance(PostmanCollectionGenerator, opt);
    await generator.run();
    return 0;
  });
}
