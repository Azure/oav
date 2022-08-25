// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable no-console */

import * as fs from "fs";
import * as path from "path";
import * as openapiToolsCommon from "@azure-tools/openapi-tools-common";
import { Suppression } from "@azure/openapi-markdown";
import jsYaml from "js-yaml";
import * as jsonUtils from "./util/jsonUtils";
import * as specResolver from "./validators/specResolver";
import * as umlGeneratorLib from "./umlGenerator";
import * as utils from "./util/utils";

import {
  CommonValidationResult,
  SpecValidationResult,
  SpecValidator,
} from "./validators/specValidator";

import { NewModelValidator as ModelValidator, SwaggerExampleErrorDetail} from "./swaggerValidator/modelValidator";
import { NodeError } from "./util/validationError";
import { WireFormatGenerator } from "./wireFormatGenerator";
import { XMsExampleExtractor } from "./xMsExampleExtractor";
import ExampleGenerator from "./generator/exampleGenerator";
import { getSuppressions } from "./validators/suppressions";
import { log } from "./util/logging";
import { SemanticValidator } from "./swaggerValidator/semanticValidator";
import { ErrorCodeConstants} from "./util/errorDefinitions";
import { TrafficValidationIssue, TrafficValidationOptions, TrafficValidator} from "./swaggerValidator/trafficValidator";
import { ReportGenerator } from "./report/generateReport";

export interface Options extends specResolver.Options, umlGeneratorLib.Options {
  consoleLogLevel?: unknown;
  logFilepath?: unknown;
  pretty?: boolean;
}

export const getDocumentsFromCompositeSwagger = async (
  suppression: Suppression | undefined,
  compositeSpecPath: string,
  reportError: openapiToolsCommon.ReportError
): Promise<string[]> => {
  try {
    const compositeSwagger = await jsonUtils.parseJson(suppression, compositeSpecPath, reportError);
    if (
      !(
        compositeSwagger.documents &&
        Array.isArray(compositeSwagger.documents) &&
        compositeSwagger.documents.length > 0
      )
    ) {
      throw new Error(
        `CompositeSwagger - ${compositeSpecPath} must contain a documents property and it must ` +
          `be of type array and it must be a non empty array.`
      );
    }
    const docs = compositeSwagger.documents;
    const basePath = path.dirname(compositeSpecPath);
    const finalDocs: string[] = [];
    for (let i = 0; i < docs.length; i++) {
      if (docs[i].startsWith(".")) {
        docs[i] = docs[i].substring(1);
      }
      const individualPath = docs[i].startsWith("http") ? docs[i] : basePath + docs[i];
      finalDocs.push(individualPath);
    }
    return finalDocs;
  } catch (err) {
    log.error(err);
    throw err;
  }
};

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

const prettyPrintInfo = <T>(
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

export async function validateCompositeSpec(
  compositeSpecPath: string,
  options: Options
): Promise<readonly SpecValidationResult[]> {
  return validate(options, async (o) => {
    const suppression = await getSuppressions(compositeSpecPath);
    const docs = await getDocumentsFromCompositeSwagger(
      suppression,
      compositeSpecPath,
      openapiToolsCommon.defaultErrorReport
    );
    o.consoleLogLevel = log.consoleLogLevel;
    o.logFilepath = log.filepath;
    const promiseFactories = docs.map((doc) => async () => validateSpec(doc, o));
    return utils.executePromisesSequentially(promiseFactories);
  });
}

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
        code: ErrorCodeConstants.INTERNAL_ERROR as any
      };
      return [error];
    }
  });
}

export async function validateTrafficAgainstSpec(
  specPath: string,
  trafficPath: string,
  options: TrafficValidationOptions
): Promise<Array<TrafficValidationIssue>>{
  specPath = path.resolve(process.cwd(), specPath);
  trafficPath = path.resolve(process.cwd(), trafficPath);
  if (!fs.existsSync(specPath)) {
    const error = new Error(`Can not find specPath:${specPath}, please check your specPath parameter.`);
    log.error(JSON.stringify(error));
    throw error;
  }

  if (!fs.existsSync(trafficPath)) {
    const error = new Error(`Can not find trafficPath:${trafficPath}, please check your trafficPath parameter.`);
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
      const msg = `Detail error message:${err?.message}. ErrorStack:${err?.Stack}`
      log.error(msg);
      trafficValidationResult.push({
        payloadFilePath: specPath,
        runtimeExceptions: [
          {
            code: ErrorCodeConstants.RUNTIME_ERROR,
            message: msg,
          }
        ],
      });
    }
    if (options.reportPath) {
      const generator = new ReportGenerator(trafficValidationResult, validator!.operationCoverageResult, validator!.operationUndefinedResult, options);
      await generator.generateHtmlReport();
    }
    else if (trafficValidationResult.length > 0) {
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

export async function resolveSpec(
  specPath: string,
  outputDir: string,
  options: Options,
  reportError: openapiToolsCommon.ReportError
): Promise<void> {
  if (!options) {
    options = {};
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  const specFileName = path.basename(specPath);
  try {
    const suppression = await getSuppressions(specPath);
    const result = await jsonUtils.parseJson(suppression, specPath, reportError);
    const resolver = new specResolver.SpecResolver(specPath, result, options, reportError);
    await resolver.resolve(suppression);
    const resolvedSwagger = JSON.stringify(resolver.specInJson, null, 2);
    if (outputDir !== "./" && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    const outputFilepath = `${path.join(outputDir, specFileName)}`;
    fs.writeFileSync(`${path.join(outputDir, specFileName)}`, resolvedSwagger, {
      encoding: "utf8",
    });
    console.log(`Saved the resolved spec at "${outputFilepath}".`);
  } catch (err) {
    log.error(err);
    throw err;
  }
}

export async function resolveCompositeSpec(
  specPath: string,
  outputDir: string,
  options: Options
): Promise<void> {
  if (!options) {
    options = {};
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  try {
    const suppression = await getSuppressions(specPath);
    const docs = await getDocumentsFromCompositeSwagger(
      suppression,
      specPath,
      openapiToolsCommon.defaultErrorReport
    );
    // eslint-disable-next-line require-atomic-updates
    options.consoleLogLevel = log.consoleLogLevel;
    // eslint-disable-next-line require-atomic-updates
    options.logFilepath = log.filepath;
    const promiseFactories = docs.map(
      (doc) => async () =>
        resolveSpec(doc, outputDir, options, openapiToolsCommon.defaultErrorReport)
    );
    await utils.executePromisesSequentially(promiseFactories);
  } catch (err) {
    log.error(err);
    throw err;
  }
}

export async function generateWireFormat(
  specPath: string,
  outDir: string,
  emitYaml: unknown,
  operationIds: string | null,
  options: Options
): Promise<void> {
  if (!options) {
    options = {};
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  const wfGenerator = new WireFormatGenerator(specPath, null, outDir, emitYaml);
  try {
    await wfGenerator.initialize();
    log.info(`Generating wire format request and responses for swagger spec: "${specPath}":\n`);
    wfGenerator.processOperations(operationIds);
  } catch (err) {
    log.error(err);
    throw err;
  }
}

export async function generateWireFormatInCompositeSpec(
  compositeSpecPath: string,
  outDir: string,
  emitYaml: unknown,
  options: Options
): Promise<void> {
  if (!options) {
    options = {};
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  try {
    const suppression = await getSuppressions(compositeSpecPath);
    const docs = await getDocumentsFromCompositeSwagger(
      suppression,
      compositeSpecPath,
      openapiToolsCommon.defaultErrorReport
    );
    // eslint-disable-next-line require-atomic-updates
    options.consoleLogLevel = log.consoleLogLevel;
    // eslint-disable-next-line require-atomic-updates
    options.logFilepath = log.filepath;
    const promiseFactories = docs.map(
      (doc) => async () => generateWireFormat(doc, outDir, emitYaml, null, options)
    );
    await utils.executePromisesSequentially(promiseFactories);
  } catch (err) {
    log.error(err);
    throw err;
  }
}

export async function generateUml(
  specPath: string,
  outputDir: string,
  options?: Options
): Promise<void> {
  if (!options) {
    options = {};
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  const specFileName = path.basename(specPath);
  const resolverOptions = {
    shouldResolveRelativePaths: true,
    shouldResolveXmsExamples: false,
    shouldResolveAllOf: false,
    shouldSetAdditionalPropertiesFalse: false,
    shouldResolvePureObjects: false,
    shouldResolveDiscriminator: false,
    shouldResolveParameterizedHost: false,
    shouldResolveNullableTypes: false,
  };
  try {
    const suppression = await getSuppressions(specPath);
    const result = await jsonUtils.parseJson(
      suppression,
      specPath,
      openapiToolsCommon.defaultErrorReport
    );
    const resolver = new specResolver.SpecResolver(
      specPath,
      result,
      resolverOptions,
      openapiToolsCommon.defaultErrorReport
    );
    const umlGenerator = new umlGeneratorLib.UmlGenerator(resolver.specInJson, options);
    const svgGraph = await umlGenerator.generateDiagramFromGraph();
    if (outputDir !== "./" && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    const svgFile = specFileName.replace(path.extname(specFileName), ".svg");
    const outputFilepath = `${path.join(outputDir, svgFile)}`;
    fs.writeFileSync(`${path.join(outputDir, svgFile)}`, svgGraph, {
      encoding: "utf8",
    });
    console.log(`Saved the uml at "${outputFilepath}". Please open the file in a browser.`);
  } catch (err) {
    log.error(err);
    throw err;
  }
}

export function updateEndResultOfSingleValidation<T extends CommonValidationResult>(
  validator: SpecValidator<T>
): void {
  if (validator.specValidationResult.validityStatus) {
    if (!(log.consoleLogLevel === "json" || log.consoleLogLevel === "off")) {
      log.info("No Errors were found.");
    }
  }
  if (!validator.specValidationResult.validityStatus) {
    process.exitCode = 1;
  }
}

export function logDetailedInfo<T extends CommonValidationResult>(
  validator: SpecValidator<T>
): void {
  if (log.consoleLogLevel === "json") {
    console.dir(validator.specValidationResult, { depth: null, colors: true });
  }
  log.silly("############################");
  log.silly(validator.specValidationResult.toString());
  log.silly("----------------------------");
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
  const xMsExampleExtractor = new XMsExampleExtractor(specPath, recordings, options);
  return xMsExampleExtractor.extract();
}

export async function generateExamples(
  specPath: string,
  payloadDir?: string,
  operationIds?: string,
  readme?: string,
  tag?: string,
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
    const generator = new ExampleGenerator(file, payloadDir);
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
