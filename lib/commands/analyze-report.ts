// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as path from "path";
import * as yargs from "yargs";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import {
  NewmanReportAnalyzer,
  NewmanReportAnalyzerOption,
} from "../apiScenario/postmanReportAnalyzer";
import { defaultQualityReportFilePath } from "../apiScenario/defaultNaming";
import { inversifyGetInstance } from "../inversifyUtils";

export const command = "analyze-report <newman-report-path>";

export const describe = "analyze report. default format: newman json report";

export const builder: yargs.CommandBuilder = {
  output: {
    describe:
      "The generated report output filepath. default is <newman-report-dir>/<newman-report-name>_report.json",
    string: true,
    alias: "n",
  },
  level: {
    describe:
      "validation level. oav runner validate request and response with different strict level. 'validate-request' only validate request should return 2xx status code. 'validate-request-response' validate both request and response.",
    string: true,
    default: "validate-request-response",
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    const newmanReportPath = path.resolve(argv.newmanReportPath);
    const reportOutputFilePath = argv.n || defaultQualityReportFilePath(argv.newmanReportPath);
    const opts: NewmanReportAnalyzerOption = {
      newmanReportFilePath: newmanReportPath,
      reportOutputFilePath: reportOutputFilePath,
      validationLevel: argv.level,
    };
    const analyzer = inversifyGetInstance(NewmanReportAnalyzer, opts);
    await analyzer.analyze();

    return 0;
  });
}
