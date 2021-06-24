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

import { ModelValidationError } from "./util/modelValidationError";
import { ModelValidator } from "./validators/modelValidator";
import { NodeError } from "./util/validationError";
import { SemanticValidator } from "./validators/semanticValidator";
import { WireFormatGenerator } from "./wireFormatGenerator";
import { XMsExampleExtractor } from "./xMsExampleExtractor";
import ExampleGenerator from "./generator/exampleGenerator";
import { getErrorsFromModelValidation } from "./util/getErrorsFromModelValidation";
import { getSuppressions } from "./validators/suppressions";
import { log } from "./util/logging";
import { getInputFiles } from "./generator/util";
import { LiveValidator } from "../lib/validators/liveValidator"
import { LiveValidationIssue } from "../lib/validators/liveValidator"

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
        console.error(vsoLogIssueWrapper(errorType, errorType));
        // eslint-disable-next-line no-console
        console.error(vsoLogIssueWrapper(errorType, yaml));
      } else {
        // eslint-disable-next-line no-console
        console.error("\x1b[31m", errorType, ":", "\x1b[0m");
        // eslint-disable-next-line no-console
        console.error(yaml);
      }
    }
  }
};

export const validateSpec = async (
  specPath: string,
  options: Options | undefined
): Promise<SpecValidationResult> =>
  validate(options, async (o) => {
    // As a part of resolving discriminators we replace all the parent references
    // with a oneOf array containing references to the parent and its children.
    // This breaks the swagger specification 2.0 schema since oneOf is not supported.
    // Hence we disable it since it is not required for semantic check.

    o.shouldResolveDiscriminator = false;
    // parameters in 'x-ms-parameterized-host' extension need not be resolved for semantic
    // validation as that would not match the path parameters defined in the path template
    // and cause the semantic validation to fail.
    o.shouldResolveParameterizedHost = false;

    // We shouldn't be resolving nullable types for semantic validation as we'll replace nodes
    // with oneOf arrays which are not semantically valid in swagger 2.0 schema.
    o.shouldResolveNullableTypes = false;

    const validator = new SemanticValidator(specPath, null, o);
    try {
      await validator.initialize();
      log.info(`Semantically validating  ${specPath}:\n`);
      const validationResults = await validator.validateSpec();
      updateEndResultOfSingleValidation(validator);
      logDetailedInfo(validator);
      if (o.pretty) {
        const resolveSpecError = validator.specValidationResult.resolveSpec;
        if (resolveSpecError !== undefined || validationResults.errors.length > 0) {
          console.log(vsoLogIssueWrapper("error", `Semantically validating  ${specPath}:\n`));
        } else if (validationResults.warnings && validationResults.warnings.length > 0) {
          console.log(vsoLogIssueWrapper("warning", `Semantically validating  ${specPath}:\n`));
        } else {
          console.log(`Semantically validating  ${specPath}: without error.\n`);
        }
        if (resolveSpecError !== undefined) {
          prettyPrint([resolveSpecError], "error");
        }
        if (validationResults.errors.length > 0) {
          prettyPrint(validationResults.errors, "error");
        }
        if (validationResults.warnings && validationResults.warnings.length > 0) {
          prettyPrint(validationResults.warnings, "warning");
        }
      }
      return validator.specValidationResult;
    } catch (err) {
      let outputMsg = err;
      if (typeof err === "object") {
        outputMsg = jsYaml.dump(err);
      }
      if (o.pretty) {
        if (process.env["Agent.Id"]) {
          console.error(vsoLogIssueWrapper("error", `Semantically validating ${specPath}:\n`));
          console.error(vsoLogIssueWrapper("error", outputMsg));
        } else {
          console.error(`Semantically validating ${specPath}:\n`);
          console.error("\x1b[31m", "error", ":", "\x1b[0m");
          console.error(outputMsg);
        }
      } else {
        log.error(outputMsg);
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
): Promise<readonly ModelValidationError[]> {
  return validate(options, async (o) => {
    const validator = new ModelValidator(specPath, null, o);
    try {
      await validator.initialize();
      log.info(`Validating "examples" and "x-ms-examples" in  ${specPath}:\n`);
      await validator.validateOperations(operationIds);
      updateEndResultOfSingleValidation(validator);
      logDetailedInfo(validator);
      const errors = getErrorsFromModelValidation(validator.specValidationResult);
      if (o.pretty) {
        if (errors.length > 0) {
          console.log(
            vsoLogIssueWrapper(
              "error",
              `Validating "examples" and "x-ms-examples" in  ${specPath}:\n`
            )
          );
          prettyPrint(errors, "error");
        }
      }
      return errors;
    } catch (e) {
      if (o.pretty) {
        if (process.env["Agent.Id"]) {
          console.log(
            vsoLogIssueWrapper(
              "error",
              `Validating "examples" and "x-ms-examples" in  ${specPath}:\n`
            )
          );
          console.error(vsoLogIssueWrapper("error", e));
        } else {
          console.error(`Validating "examples" and "x-ms-examples" in  ${specPath}:\n`);
          console.error("\x1b[31m", "error", ":", "\x1b[0m");
          console.error(e);
        }
      } else {
        log.error(e);
      }
      validator.specValidationResult.validityStatus = false;
      updateEndResultOfSingleValidation(validator);
      return [{ inner: e }];
    }
  });
}

export async function validateExamplesInCompositeSpec(
  compositeSpecPath: string,
  options: Options
): Promise<ReadonlyArray<readonly ModelValidationError[]>> {
  return validate(options, async (o) => {
    o.consoleLogLevel = log.consoleLogLevel;
    o.logFilepath = log.filepath;
    const suppression = await getSuppressions(compositeSpecPath);
    const docs = await getDocumentsFromCompositeSwagger(
      suppression,
      compositeSpecPath,
      openapiToolsCommon.defaultErrorReport
    );
    const promiseFactories = docs.map((doc) => async () => validateExamples(doc, undefined, o));
    return utils.executePromisesSequentially(promiseFactories);
  });
}

export async function validateTrafficInSpec(
  specPath: string,
  trafficPath: string,
  options: Options
): Promise<Array<LiveValidationIssue | Error>>{
  if (!specPath) {
    const error = new Error(`specPath parameter can't be empty, must provide specPath parameter.`);
    console.log(JSON.stringify(error));
    return [error];
  }

  if (!trafficPath) {
    const error = new Error(`trafficPath parameter can't be empty, must provide trafficPath parameter.`);
    console.log(JSON.stringify(error));
    return [error];
  }

  try {
    const trafficFile = require(trafficPath);
    const specFileDirectory = path.dirname(specPath);
    const swaggerPathsPattern = specPath.slice(specFileDirectory.length + 1);

    return validate(options, async (o) => {
      o.consoleLogLevel = log.consoleLogLevel;
      o.logFilepath = log.filepath;
      const liveValidationOptions = {
        directory: specFileDirectory,
        swaggerPathsPattern: [swaggerPathsPattern],
        git: {
          shouldClone: false
        }
      }
      const validator = new LiveValidator(liveValidationOptions);
      const errors: Array<LiveValidationIssue> = [];
      await validator.initialize();

      const result = validator.validateLiveRequestResponse(trafficFile);
    
      if (!result.requestValidationResult.isSuccessful) {
        errors.push(...result.requestValidationResult.errors);
      }

      if (!result.responseValidationResult.isSuccessful) {
        errors.push(...result.responseValidationResult.errors);
      }

      if (errors.length > 0) {
        for (let error of errors) {
          console.log(JSON.stringify(error));
        }
      } else {
        console.log('Validation compelete, no errors are detected.');
      }

      return errors;
    });
  } catch (error) {
    console.log(JSON.stringify(error));
    return [error];
  }
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
    const promiseFactories = docs.map((doc) => async () =>
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
    const promiseFactories = docs.map((doc) => async () =>
      generateWireFormat(doc, outDir, emitYaml, null, options)
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
    const result = await jsonUtils.parseJson(suppression, specPath, openapiToolsCommon.defaultErrorReport);
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
  const wholeInputFiles: string[] = []
  if (readme && tag) {
    const inputFiles = await getInputFiles(readme, tag);
    if (!inputFiles) {
      throw Error("get input files from readme tag failed.")
    }
    inputFiles.forEach(file => {
      if (path.isAbsolute(file)) {
        wholeInputFiles.push(file);
      }
      else {
        wholeInputFiles.push(path.join(path.dirname(readme),file));
      }
    })
  }
  else if (specPath) {
    wholeInputFiles.push(specPath);
  }
  if (wholeInputFiles.length === 0) {
    console.error(`no spec file specified !`)
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
