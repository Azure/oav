// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as fs from "fs";
import * as path from "path";
import { pathDirName, pathJoin, pathResolve } from "@azure-tools/openapi-tools-common";
import { findReadMe } from "@azure/openapi-markdown";
import * as yargs from "yargs";
import winston from "winston";
import {
  PostmanCollectionGenerator,
  PostmanCollectionGeneratorOption,
} from "../apiScenario/postmanCollectionGenerator";
import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { inversifyGetInstance } from "../inversifyUtils";
import { logger } from "../apiScenario/logger";
import {
  findGitRootDirectory,
  getApiScenarioFiles,
  getDefaultTag,
  getInputFiles,
  resetPseudoRandomSeed,
} from "../util/utils";
import { EnvironmentVariables } from "../apiScenario/variableEnv";
import { DEFAULT_ARM_ENDPOINT } from "../apiScenario/constants";
import { log } from "../util/logging";
import { LiveValidatorLoggingLevels } from "../liveValidation/liveValidator";

export const command = "run-api-scenario [<api-scenario>]";

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
  flag: {
    describe: "readme.test.md flag",
    string: true,
  },
  specs: {
    describe: "One or more spec file paths.",
    type: "array",
  },
  output: {
    alias: "outputDir",
    describe: "Result output folder.",
    string: true,
    default: ".apitest",
  },
  report: {
    describe: "Generate report type. Supported types: html, markdown, junit",
    type: "array",
  },
  skipValidation: {
    describe: "Skip all validations include schema validation, ARM rules validation.",
    boolean: true,
    default: false,
  },
  armEndpoint: {
    describe: "ARM endpoint",
    string: true,
    default: DEFAULT_ARM_ENDPOINT,
  },
  location: {
    describe: "Resource provision location parameter",
    string: true,
  },
  subscriptionId: {
    alias: "subscription",
    describe: "SubscriptionId to run API test",
    string: true,
  },
  resourceGroupName: {
    alias: "resourceGroup",
    describe: "Resource group name",
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
  savePayload: {
    describe: "Save live traffic payload to file",
    boolean: true,
    default: false,
  },
  generateExample: {
    describe: "Generate examples after API Test",
    boolean: true,
    default: false,
  },
  testProxy: {
    describe:
      "Test-proxy endpoint, e.g., http://localhost:5000. If not set, no proxy will be used.",
    string: true,
  },
  testProxyAssets: {
    describe:
      "Test-proxy assets file to push and restore recordings. Only used when test-proxy is set.",
    string: true,
  },
  devMode: {
    describe: "Development mode. If set, will skip AAD auth and ARM API call.",
    boolean: true,
    default: false,
  },
  randomSeed: {
    describe: "Random seed for random number generator",
    number: true,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    // suppress warning log in live validator
    log.consoleLogLevel = LiveValidatorLoggingLevels.error;

    if (argv.randomSeed !== undefined) {
      resetPseudoRandomSeed(argv.randomSeed);
    }

    if (argv.logLevel) {
      const transport = logger.transports.find((t) => t instanceof winston.transports.Console);
      if (transport !== undefined) {
        transport.level = argv.logLevel;
      }
    }

    const scenarioFiles = [];
    let readmePath = argv.readme ? pathResolve(argv.readme) : undefined;
    if (argv.apiScenario) {
      const scenarioFilePath = pathResolve(argv.apiScenario);
      scenarioFiles.push(scenarioFilePath);
      if (!readmePath) {
        readmePath = await findReadMe(pathDirName(scenarioFilePath));
      }
    }

    const swaggerFilePaths: string[] = [];
    for (const spec of argv.specs ?? []) {
      const specFile = pathResolve(spec);
      if (specFile && swaggerFilePaths.indexOf(specFile) < 0) {
        swaggerFilePaths.push(specFile);
      }
    }
    if (readmePath) {
      const inputFile = await getInputFiles(readmePath, argv.tag);
      for (const it of inputFile ?? []) {
        if (swaggerFilePaths.indexOf(it) < 0) {
          swaggerFilePaths.push(pathJoin(pathDirName(readmePath), it));
        }
      }

      if (!argv.apiScenario) {
        const tag = argv.tag ?? (await getDefaultTag(readmePath));
        const testResources = await getApiScenarioFiles(
          pathJoin(pathDirName(readmePath), "readme.test.md"),
          tag,
          argv.flag
        );
        for (const it of testResources ?? []) {
          scenarioFiles.push(pathJoin(pathDirName(readmePath), it));
        }
      }
    }

    logger.info("swagger-file:");
    logger.info(swaggerFilePaths);
    logger.info("scenario-file:");
    logger.info(scenarioFiles);

    let env: EnvironmentVariables = {};
    if (argv.envFile !== undefined) {
      env = JSON.parse(fs.readFileSync(argv.envFile).toString());
    }
    if (process.env[apiScenarioEnvKey]) {
      const envFromVariable = JSON.parse(process.env[apiScenarioEnvKey] as string);
      for (const key of Object.keys(envFromVariable)) {
        if (env[key] !== undefined && envFromVariable[key] !== env[key]) {
          logger.warn(
            `Notice: the variable '${key}' in '${argv.e}' is overwritten by the variable in the environment '${apiScenarioEnvKey}'.`
          );
        }
      }
      env = { ...env, ...envFromVariable };
    }

    ["armEndpoint", "location", "subscriptionId", "resourceGroupName"]
      .filter((k) => argv[k] !== undefined)
      .forEach((k) => (env[k] = argv[k]));

    const fileRoot = readmePath
      ? findGitRootDirectory(readmePath) ?? pathDirName(readmePath)
      : process.cwd();
    logger.verbose(`fileRoot: ${fileRoot}`);

    const opt: PostmanCollectionGeneratorOption = {
      fileRoot,
      checkUnderFileRoot: false,
      swaggerFilePaths: swaggerFilePaths,
      generateCollection: true,
      useJsonParser: false,
      runCollection: !argv.dryRun,
      env,
      outputFolder: argv.output,
      markdown: (argv.report ?? []).includes("markdown"),
      junit: (argv.report ?? []).includes("junit"),
      html: (argv.report ?? []).includes("html"),
      eraseXmsExamples: false,
      eraseDescription: false,
      testProxy: argv.testProxy,
      testProxyAssets:
        argv.testProxy && argv.testProxyAssets ? path.resolve(argv.testProxyAssets) : undefined,
      skipValidation: argv.skipValidation,
      savePayload: argv.savePayload,
      generateExample: argv.generateExample,
      verbose: ["verbose", "debug", "silly"].indexOf(argv.logLevel) >= 0,
      devMode: argv.devMode,
    };

    logger.debug("options:");
    logger.debug(opt);

    const generator = inversifyGetInstance(PostmanCollectionGenerator, opt);

    for (const scenarioFile of scenarioFiles) {
      await generator.run(scenarioFile, argv.skipCleanUp);
    }

    await generator.cleanUpAll();

    return 0;
  });
}
