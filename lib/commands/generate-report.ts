// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import * as fs from "fs";
import * as path from "path";
import * as yargs from "yargs";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { getAutorestConfig } from "../util/getAutorestConfig";
import { ReportGenerator } from "../testScenario/reportGenerator";
export const command = "generate-report [raw-report-path]";

export const describe = "Generate report from postman report.";

export const builder: yargs.CommandBuilder = {
  newmanReport: {
    describe: "The newman report",
    string: true,
  },
  tag: {
    describe: "the readme tag name.",
    string: true,
  },
  output: {
    alias: "outputDir",
    describe: "the output folder.",
    string: true,
    default: "generated",
  },
  readme: {
    describe: "path to readme.md file",
    string: true,
    demandOption: true,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const readmeMd: string = argv.readme;
    const newmanReport: string = argv.newmanReport;
    argv["try-require"] = "readme.test.md";
    const autorestConfig = await getAutorestConfig(argv, readmeMd);
    const fileRoot: string = path.dirname(readmeMd);
    const swaggerFilePaths: string[] = autorestConfig["input-file"];
    const testScenarioFile = autorestConfig["test-resources"][0]["test"];
    console.log(
      `generating report from ${newmanReport}. test-scenario: ${testScenarioFile} outputDir: ${argv.output}`
    );
    if (!fs.existsSync(argv.output)) {
      fs.mkdirSync(argv.output);
    }
    const generator = new ReportGenerator(
      newmanReport,
      argv.output,
      fileRoot,
      swaggerFilePaths,
      testScenarioFile,
      readmeMd
    );
    await generator.generateReport();
    console.log(`generate report successfully!`);
    return 0;
  });
}
