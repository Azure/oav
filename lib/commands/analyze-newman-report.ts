import { defaultQualityReportFilePath } from "./../testScenario/postmanItemNaming";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as path from "path";
import * as yargs from "yargs";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import {
  NewmanReportAnalyzer,
  NewmanReportAnalyzerOption,
} from "../testScenario/postmanReportAnalyzer";
import { inversifyGetInstance } from "./../inversifyUtils";

export const command = "analyze-newman-report <newman-report-path>";

export const describe = "analyze newman report.";

export const builder: yargs.CommandBuilder = {
  output: {
    describe:
      "The generated report output filepath. default is <newman-report-dir>/<newman-report-name>_report.json",
    string: true,
    alias: "n",
  },
  uploadBlob: {
    describe: "upload generated collection to blob.",
    boolean: true,
    default: false,
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const newmanReportPath = path.resolve(argv.newmanReportPath);
    const reportOutputFilePath = argv.n || defaultQualityReportFilePath(argv.newmanReportPath);
    const opts: NewmanReportAnalyzerOption = {
      newmanReportFilePath: newmanReportPath,
      reportOutputFilePath: reportOutputFilePath,
      enableUploadBlob: argv.uploadBlob,
    };
    const analyzer = inversifyGetInstance(NewmanReportAnalyzer, opts);
    await analyzer.analyze();

    return 0;
  });
}
