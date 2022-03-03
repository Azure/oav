import * as yargs from "yargs";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { TrafficValidationOptions } from "../swaggerValidator/trafficValidator";
import { log } from "../util/logging";
import * as validate from "../validate";

export const command = "validate-traffic <traffic-path> <spec-path>";
export const describe = "Validate traffic payload against the spec.";

export const builder: yargs.CommandBuilder = {
  trafficPath: {
    alias: "t",
    describe: "The recording payload path.",
    string: true,
  },
  specPath: {
    alias: "s",
    describe: "The targeted swagger spec path.",
    string: true,
  },
  package: {
    alias: "pkg",
    describe: "The target SDK package name",
    string: true,
    default: "azure-data-tables",
  },
  language: {
    alias: "lang",
    describe: "The target language of SDK",
    string: true,
    default: "Dotnet",
  },
  report: {
    alias: "r",
    describe: "path and file name for the report",
    string: true,
    default: "./SwaggerAccuracyReport.html",
  },
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    log.debug(argv.toString());
    const specPath = argv.specPath;
    const trafficPath = argv.trafficPath;
    const vOptions: TrafficValidationOptions = {
      consoleLogLevel: argv.logLevel,
      logFilepath: argv.f,
      pretty: argv.p,
      sdkPackage: argv.package,
      sdkLanguage: argv.language,
      reportPath: argv.report,
    };
    const errors = await validate.validateTrafficAgainstSpec(specPath, trafficPath, vOptions);
    return errors.length > 0 ? 1 : 0;
  });
}
