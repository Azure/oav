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
import { getApiScenarioFiles, getDefaultTag, getInputFiles, printWarning } from "../util/utils";
import { EnvironmentVariables } from "../apiScenario/variableEnv";
import { DEFAULT_ARM_ENDPOINT } from "../apiScenario/constants";

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
    describe: "One or more spec file paths. type: array",
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
    describe:
      "Skip all validations include schema validation, ARM rules validation. Default: false",
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
    describe: "TestProxy endpoint, e.g., http://localhost:5000. If not set, no proxy will be used.",
    string: true,
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
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const scenarioFiles = [];
    let readmePath = argv.readme ? pathResolve(argv.readme) : undefined;
    if (argv.apiScenario) {
      const scenarioFilePath = pathResolve(argv.apiScenario);
      scenarioFiles.push(scenarioFilePath);
      if (!readmePath) {
        readmePath = await findReadMe(pathDirName(scenarioFilePath));
      }
    }

    const fileRoot = readmePath ? pathDirName(readmePath) : process.cwd();
    console.log(`fileRoot: ${fileRoot}`);

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
          swaggerFilePaths.push(pathJoin(fileRoot, it));
        }
      }

      if (!argv.apiScenario) {
        const tag = argv.tag ?? (await getDefaultTag(readmePath));
        scenarioFiles.push(
          ...(
            await getApiScenarioFiles(
              pathJoin(pathDirName(readmePath), "readme.test.md"),
              tag,
              argv.flag
            )
          ).map((it) => pathJoin(fileRoot, it))
        );
      }
    }

    console.log("input-file:");
    console.log(swaggerFilePaths);
    console.log("scenario-file:");
    console.log(scenarioFiles);

    for (const scenarioFilePath of scenarioFiles) {
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

      if (argv.armEndpoint !== undefined) {
        env.armEndpoint = argv.armEndpoint;
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
        markdown: (argv.report ?? []).includes("markdown"),
        junit: (argv.report ?? []).includes("junit"),
        html: (argv.report ?? []).includes("html"),
        eraseXmsExamples: false,
        eraseDescription: false,
        testProxy: argv.testProxy,
        skipValidation: argv.skipValidation,
        savePayload: argv.savePayload,
        generateExample: argv.generateExample,
        skipCleanUp: argv.skipCleanUp,
        verbose: argv.verbose,
        swaggerFilePaths: swaggerFilePaths,
        devMode: argv.devMode,
      };
      const generator = inversifyGetInstance(PostmanCollectionGenerator, opt);
      await generator.run();
    }

    return 0;
  });
}
