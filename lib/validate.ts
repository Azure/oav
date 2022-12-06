// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable no-console */

import * as fs from "fs";
import * as path from "path";
import * as openapiToolsCommon from "@azure-tools/openapi-tools-common";
import jsYaml from "js-yaml";
import * as utils from "./util/utils";

import {
  NewModelValidator as ModelValidator,
  SwaggerExampleErrorDetail,
} from "./swaggerValidator/modelValidator";
import { NodeError } from "./util/validationError";
import * as XMsExampleExtractor from "./xMsExampleExtractor";
import ExampleGenerator from "./generator/exampleGenerator";
import { log } from "./util/logging";
import { SemanticValidator } from "./swaggerValidator/semanticValidator";
import { ErrorCodeConstants } from "./util/errorDefinitions";
import {
  TrafficValidationIssue,
  TrafficValidationOptions,
  TrafficValidator,
} from "./swaggerValidator/trafficValidator";
import { ReportGenerator } from "./report/generateReport";

export interface Options extends XMsExampleExtractor.Options {
  consoleLogLevel?: unknown;
  logFilepath?: unknown;
  pretty?: boolean;
}

const vsoLogIssueWrapper = (issueType: string, message: string) => {
  if (issueType === "error" || issueType === "warning") {
    return `##vso[task.logissue type=${issueType}]${message}`;
  } else {
    return `##vso[task.logissue type=${issueType}]${message}`;
  }
};

const validate = async <T>(
  options: Options | undefined,
  func: (options: Options) => Promise<T>
): Promise<T> => {
  if (!options) {
    options = {};
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  if (options.pretty) {
    log.consoleLogLevel = "off";
  }
  return func(options);
};

type ErrorType = "error" | "warning";

const prettyPrint = <T extends NodeError<T>>(
  errors: readonly T[] | undefined,
  errorType: ErrorType
) => {
  if (errors !== undefined) {
    for (const error of errors) {
      const yaml = jsYaml.dump(error);
      if (process.env["Agent.Id"]) {
        // eslint-disable-next-line no-console
        console.error(vsoLogIssueWrapper(errorType, yaml));
      } else {
        // eslint-disable-next-line no-console
        console.error(yaml);
      }
    }
  }
};

const prettyPrintInfo = <T>(errors: readonly T[] | undefined, errorType: ErrorType) => {
  if (errors !== undefined) {
    for (const error of errors) {
      const yaml = jsYaml.dump(error);
      if (process.env["Agent.Id"]) {
        // eslint-disable-next-line no-console
        console.error(vsoLogIssueWrapper(errorType, yaml));
      } else {
        // eslint-disable-next-line no-console
        console.error(yaml);
      }
    }
  }
};

export const validateSpec = async (specPath: string, options: Options | undefined) =>
  validate(options, async (o) => {
    const validator = new SemanticValidator(specPath, null);
    try {
      await validator.initialize();
      log.info(`Semantically validating  ${specPath}:\n`);
      const validationResults = await validator.validateSpec();
      if (o.pretty) {
        if (validationResults.errors.length > 0) {
          logMessage(`Semantically validating ${specPath}`, "error");
        } else {
          logMessage(`Semantically validating ${specPath} without error`, "info");
        }
        if (validationResults.errors.length > 0) {
          logMessage(`Errors reported:`, "error");
          prettyPrint(validationResults.errors, "error");
        }
      } else {
        if (validationResults.errors.length > 0) {
          logMessage(`Errors reported:`, "error");
          for (const error of validationResults.errors) {
            // eslint-disable-next-line no-console
            log.error(error);
          }
        } else {
          logMessage(`Semantically validating ${specPath} without error`, "info");
        }
      }
      return validator.specValidationResult;
    } catch (err) {
      let outputMsg = err;
      if (typeof err === "object") {
        outputMsg = jsYaml.dump(err);
      }
      if (o.pretty) {
        logMessage(`Semantically validating ${specPath}`);
        logMessage(`${outputMsg}`, "error");
      } else {
        log.error(`Detail error:${err?.message}.ErrorStack:${err?.stack}`);
      }
      validator.specValidationResult.validityStatus = false;
      return validator.specValidationResult;
    }
  });

export async function validateExamples(
  specPath: string,
  operationIds: string | undefined,
  options?: Options
): Promise<SwaggerExampleErrorDetail[]> {
  return validate(options, async (o) => {
    try {
      const validator = new ModelValidator(specPath);
      await validator.initialize();
      log.info(`Validating "examples" and "x-ms-examples" in  ${specPath}:\n`);
      await validator.validateOperations(operationIds);
      const errors = validator.result;
      if (o.pretty) {
        if (errors.length > 0) {
          logMessage(`Validating "examples" and "x-ms-examples" in ${specPath}`, "error");
          logMessage("Error reported:");
          prettyPrint(errors, "error");
        } else {
          logMessage("Validation completes without errors.", "info");
        }
      } else {
        if (errors.length > 0) {
          logMessage("Error reported:");
          for (const error of errors) {
            log.error(error);
          }
        } else {
          logMessage("Validation completes without errors.", "info");
        }
      }
      return errors;
    } catch (e) {
      logMessage(`Validating x-ms-examples in ${specPath}`, "error");
      logMessage("Unexpected runtime exception:");
      if (o.pretty) {
        logMessage(`Detail error:${e?.message}.ErrorStack:${e?.stack}`, "error");
      } else {
        log.error(`Detail error:${e?.message}.ErrorStack:${e?.stack}`);
      }
      const error: SwaggerExampleErrorDetail = {
        inner: e,
        message: "Unexpected internal error",
        code: ErrorCodeConstants.INTERNAL_ERROR as any,
      };
      return [error];
    }
  });
}

export async function validateTrafficAgainstSpec(
  specPath: string,
  trafficPath: string,
  options: TrafficValidationOptions
): Promise<TrafficValidationIssue[]> {
  specPath = path.resolve(process.cwd(), specPath);
  trafficPath = path.resolve(process.cwd(), trafficPath);
  if (!fs.existsSync(specPath)) {
    const error = new Error(
      `Can not find specPath:${specPath}, please check your specPath parameter.`
    );
    log.error(JSON.stringify(error));
    throw error;
  }

  if (!fs.existsSync(trafficPath)) {
    const error = new Error(
      `Can not find trafficPath:${trafficPath}, please check your trafficPath parameter.`
    );
    log.error(JSON.stringify(error));
    throw error;
  }
  return validate(options, async (o) => {
    let validator: TrafficValidator;
    o.consoleLogLevel = log.consoleLogLevel;
    o.logFilepath = log.filepath;
    const trafficValidationResult: TrafficValidationIssue[] = [];
    try {
      validator = new TrafficValidator(specPath, trafficPath);
      await validator.initialize();
      const result = await validator.validate();
      trafficValidationResult.push(...result);
    } catch (err) {
      const msg = `Detail error message:${err?.message}. ErrorStack:${err?.Stack}`;
      log.error(msg);
      trafficValidationResult.push({
        payloadFilePath: specPath,
        runtimeExceptions: [
          {
            code: ErrorCodeConstants.RUNTIME_ERROR,
            message: msg,
          },
        ],
      });
    }
    if (options.reportPath) {
      const generator = new ReportGenerator(
        trafficValidationResult,
        validator!.operationCoverageResult,
        validator!.operationUndefinedResult,
        options
      );
      await generator.generateHtmlReport();
    } else if (trafficValidationResult.length > 0) {
      if (o.pretty) {
        prettyPrintInfo(trafficValidationResult, "error");
      } else {
        for (const error of trafficValidationResult) {
          const errorInfo = JSON.stringify(error);
          log.error(errorInfo);
        }
      }
    } else {
      log.info("No errors were found.");
    }
    return trafficValidationResult;
  });
}

export async function extractXMsExamples(
  specPath: string,
  recordings: string,
  options: Options
): Promise<openapiToolsCommon.StringMap<unknown>> {
  if (!options) {
    options = {};
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  const xMsExampleExtractor = new XMsExampleExtractor.XMsExampleExtractor(
    specPath,
    recordings,
    options
  );
  return xMsExampleExtractor.extract();
}

export async function generateExamples(
  specPath: string,
  payloadDir?: string,
  operationIds?: string,
  readme?: string,
  tag?: string,
  generateRule?: "Max" | "Min",
  options?: Options
): Promise<any> {
  if (!options) {
    options = {};
  }
  const wholeInputFiles: string[] = [];
  if (readme && tag) {
    const inputFiles = await utils.getInputFiles(readme, tag);
    if (!inputFiles) {
      throw Error("get input files from readme tag failed.");
    }
    inputFiles.forEach((file) => {
      if (path.isAbsolute(file)) {
        wholeInputFiles.push(file);
      } else {
        wholeInputFiles.push(path.join(path.dirname(readme), file));
      }
    });
  } else if (specPath) {
    wholeInputFiles.push(specPath);
  }
  if (wholeInputFiles.length === 0) {
    console.error(`no spec file specified !`);
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  for (const file of wholeInputFiles) {
    const generator = new ExampleGenerator(file, payloadDir, generateRule);
    if (operationIds) {
      const operationIdArray = operationIds.trim().split(",");
      for (const operationId of operationIdArray) {
        if (operationId) {
          await generator.generate(operationId);
        }
      }
      continue;
    }
    await generator.generateAll();
  }
}

const logMessage = (message: string, level?: string) => {
  const logLevel = level || "error";
  if (process.env["Agent.Id"]) {
    if (level === "error") {
      console.error(vsoLogIssueWrapper(`${logLevel}`, `${message}\n`));
    } else {
      console.info(vsoLogIssueWrapper(`${logLevel}`, `${message}\n`));
    }
  } else {
    if (level === "error") {
      console.error(`${message}\n`);
    } else {
      console.info(`${message}\n`);
    }
  }
};
