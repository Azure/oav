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
  envFile: {
    alias: "e",
    describe: "The env file path.",
    string: true,
  },
  tag: {
    describe: "The readme tag name.",
    string: true,
  },
  readme: {
    describe: "Path to readme.md file",
    string: true,
  },
  specs: {
    describe: "One or more spec file paths. type: array",
    type: "array",
  },
  output: {
    alias: "outputDir",
    describe: "Result output folder.",
    string: true,
    default: ".apitest",
  },
  markdown: {
    alias: "markdownReportPath",
    describe: "Markdown report output path.",
    string: true,
  },
  junit: {
    alias: "junitReportPath",
    describe: "Junit report output path.",
    string: true,
  },
  level: {
    describe:
      "Validation level. oav runner validate request and response with different strict level. 'validate-request' validates requests should be successful. 'validate-request-response' validate both request and response.",
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
    describe: "Resource provision location parameter",
    string: true,
  },
  subscriptionId: {
    describe: "SubscriptionId to run API test",
    string: true,
  },
  resourceGroup: {
    describe: "Resource group",
    string: true,
  },
  skipCleanUp: {
    describe: "Whether delete resource group when all steps finished",
    boolean: true,
  },
  dryRun: {
    describe: "Dry run mode. If set, only create postman collection file not run live API test.",
    boolean: true,
    default: false,
  },
  devMode: {
    describe: "Development mode. If set, will skip AAD auth and ARM API call.",
    boolean: true,
    default: false,
  },
  verbose: {
    describe: "Log verbose",
    default: false,
    boolean: true,
  },
  generateExample: {
    describe: "Whether to generate examples from live traffic after API test",
    boolean: true,
    default: false,
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

    const swaggerFilePaths: string[] = [];
    for (const spec of argv.specs ?? []) {
      const specFile = pathResolve(spec);
      if (specFile && swaggerFilePaths.indexOf(specFile) < 0) {
        swaggerFilePaths.push(specFile);
      }
    }
    if (readmePath && argv.tag !== undefined) {
      const inputFile = await getInputFiles(readmePath, argv.tag);
      for (const it of inputFile ?? []) {
        if (swaggerFilePaths.indexOf(it) < 0) {
          swaggerFilePaths.push(pathJoin(fileRoot, it));
        }
      }
    }

    console.log("input-file:");
    console.log(swaggerFilePaths);

    let env: EnvironmentVariables = {};
    if (argv.envFile !== undefined) {
      env = JSON.parse(fs.readFileSync(argv.envFile).toString());
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
      devMode: argv.devMode,
      generateExample: argv.generateExample,
    };
    const generator = inversifyGetInstance(PostmanCollectionGenerator, opt);
    await generator.run();
    return 0;
  });
}
