// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { Suppression } from "@azure/openapi-markdown"
import * as jsonParser from "@ts-common/json-parser"
import { StringMap } from "@ts-common/string-map"
import * as fs from "fs"
import jsYaml from "js-yaml"
import * as path from "path"

import * as umlGeneratorLib from "./umlGenerator"
import { getErrorsFromModelValidation } from "./util/getErrorsFromModelValidation"
import * as jsonUtils from "./util/jsonUtils"
import { log } from "./util/logging"
import { ModelValidationError } from "./util/modelValidationError"
import * as utils from "./util/utils"
import { NodeError } from "./util/validationError"
import { ModelValidator } from "./validators/modelValidator"
import { SemanticValidator } from "./validators/semanticValidator"
import * as specResolver from "./validators/specResolver"
import {
  CommonValidationResult,
  SpecValidationResult,
  SpecValidator
} from "./validators/specValidator"
import { getSuppressions } from "./validators/suppressions"
import { WireFormatGenerator } from "./wireFormatGenerator"
import { XMsExampleExtractor } from "./xMsExampleExtractor"

export interface Options extends specResolver.Options, umlGeneratorLib.Options {
  consoleLogLevel?: unknown
  logFilepath?: unknown
  pretty?: boolean
}

export async function getDocumentsFromCompositeSwagger(
  suppression: Suppression | undefined,
  compositeSpecPath: string,
  reportError: jsonParser.ReportError
): Promise<string[]> {
  try {
    const compositeSwagger = await jsonUtils.parseJson(suppression, compositeSpecPath, reportError)
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
      )
    }
    const docs = compositeSwagger.documents
    const basePath = path.dirname(compositeSpecPath)
    const finalDocs: string[] = []
    for (let i = 0; i < docs.length; i++) {
      if (docs[i].startsWith(".")) {
        docs[i] = docs[i].substring(1)
      }
      const individualPath = docs[i].startsWith("http") ? docs[i] : basePath + docs[i]
      finalDocs.push(individualPath)
    }
    return finalDocs
  } catch (err) {
    log.error(err)
    throw err
  }
}

const vsoLogIssueWrapper = (issueType: string, message: string) => {
  return issueType === "error" || issueType === "warning"
    ? `##vso[task.logissue type=${issueType}]${message}`
    : `##vso[task.logissue type=error]${message}`
}

async function validate<T>(
  options: Options | undefined,
  func: (options: Options) => Promise<T>
): Promise<T> {
  if (!options) {
    options = {}
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  if (options.pretty) {
    log.consoleLogLevel = "off"
  }
  return func(options)
}

type ErrorType = "error" | "warning"

const prettyPrint = <T extends NodeError<T>>(
  errors: ReadonlyArray<T> | undefined,
  errorType: ErrorType
) => {
  if (errors !== undefined) {
    for (const error of errors) {
      const yaml = jsYaml.dump(error)
      if (process.env["Agent.Id"]) {
        /* tslint:disable-next-line:no-console no-string-literal */
        console.error(vsoLogIssueWrapper(errorType, errorType))
        /* tslint:disable-next-line:no-console no-string-literal */
        console.error(vsoLogIssueWrapper(errorType, yaml))
      } else {
        /* tslint:disable-next-line:no-console no-string-literal */
        console.error("\x1b[31m", errorType, ":", "\x1b[0m")
        /* tslint:disable-next-line:no-console no-string-literal */
        console.error(yaml)
      }
    }
  }
}

export async function validateSpec(
  specPath: string,
  options: Options | undefined
): Promise<SpecValidationResult> {
  return validate(options, async o => {
    // As a part of resolving discriminators we replace all the parent references
    // with a oneOf array containing references to the parent and its children.
    // This breaks the swagger specification 2.0 schema since oneOf is not supported.
    // Hence we disable it since it is not required for semantic check.

    o.shouldResolveDiscriminator = false
    // parameters in 'x-ms-parameterized-host' extension need not be resolved for semantic
    // validation as that would not match the path parameters defined in the path template
    // and cause the semantic validation to fail.
    o.shouldResolveParameterizedHost = false

    // We shouldn't be resolving nullable types for semantic validation as we'll replace nodes
    // with oneOf arrays which are not semantically valid in swagger 2.0 schema.
    o.shouldResolveNullableTypes = false

    const validator = new SemanticValidator(specPath, null, o)
    const suppression = await getSuppressions(specPath)
    await validator.initialize(suppression)
    log.info(`Semantically validating  ${specPath}:\n`)
    const validationResults = await validator.validateSpec(specPath, suppression)
    updateEndResultOfSingleValidation(validator)
    logDetailedInfo(validator)
    if (o.pretty) {
      /* tslint:disable-next-line:no-console no-string-literal */
      console.log(vsoLogIssueWrapper("error", `Semantically validating  ${specPath}:\n`))
      const resolveSpecError = validator.specValidationResult.resolveSpec
      if (resolveSpecError !== undefined) {
        prettyPrint([resolveSpecError], "error")
      }
      prettyPrint(validationResults.errors, "error")
      prettyPrint(validationResults.warnings, "warning")
    }
    return validator.specValidationResult
  })
}

export async function validateCompositeSpec(
  compositeSpecPath: string,
  options: Options
): Promise<ReadonlyArray<SpecValidationResult>> {
  return validate(options, async o => {
    const suppression = await getSuppressions(compositeSpecPath)
    const docs = await getDocumentsFromCompositeSwagger(
      suppression,
      compositeSpecPath,
      jsonParser.defaultErrorReport
    )
    o.consoleLogLevel = log.consoleLogLevel
    o.logFilepath = log.filepath
    const promiseFactories = docs.map(doc => async () => validateSpec(doc, o))
    return utils.executePromisesSequentially(promiseFactories)
  })
}

export async function validateExamples(
  specPath: string,
  operationIds: string | undefined,
  options?: Options
): Promise<ReadonlyArray<ModelValidationError>> {
  return validate(options, async o => {
    const validator = new ModelValidator(specPath, null, o)
    await validator.initialize()
    log.info(`Validating "examples" and "x-ms-examples" in  ${specPath}:\n`)
    await validator.validateOperations(operationIds)
    updateEndResultOfSingleValidation(validator)
    logDetailedInfo(validator)
    const errors = getErrorsFromModelValidation(validator.specValidationResult)
    if (o.pretty) {
      /* tslint:disable-next-line:no-console no-string-literal */
      console.log(
        vsoLogIssueWrapper("info", `Validating "examples" and "x-ms-examples" in  ${specPath}:\n`)
      )

      if (errors.length > 0) {
        prettyPrint(errors, "error")
      }
    }
    return errors
  })
}

export async function validateExamplesInCompositeSpec(
  compositeSpecPath: string,
  options: Options
): Promise<ReadonlyArray<ReadonlyArray<ModelValidationError>>> {
  return validate(options, async o => {
    o.consoleLogLevel = log.consoleLogLevel
    o.logFilepath = log.filepath
    const suppression = await getSuppressions(compositeSpecPath)
    const docs = await getDocumentsFromCompositeSwagger(
      suppression,
      compositeSpecPath,
      jsonParser.defaultErrorReport
    )
    const promiseFactories = docs.map(doc => async () => validateExamples(doc, undefined, o))
    return utils.executePromisesSequentially(promiseFactories)
  })
}

export async function resolveSpec(
  specPath: string,
  outputDir: string,
  options: Options,
  reportError: jsonParser.ReportError
): Promise<void> {
  if (!options) {
    options = {}
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  const specFileName = path.basename(specPath)
  try {
    const suppression = await getSuppressions(specPath)
    const result = await jsonUtils.parseJson(suppression, specPath, reportError)
    const resolver = new specResolver.SpecResolver(specPath, result, options, reportError)
    await resolver.resolve(suppression)
    const resolvedSwagger = JSON.stringify(resolver.specInJson, null, 2)
    if (outputDir !== "./" && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }
    const outputFilepath = `${path.join(outputDir, specFileName)}`
    fs.writeFileSync(`${path.join(outputDir, specFileName)}`, resolvedSwagger, {
      encoding: "utf8"
    })
    /* tslint:disable-next-line */
    console.log(`Saved the resolved spec at "${outputFilepath}".`)
  } catch (err) {
    log.error(err)
    throw err
  }
}

export async function resolveCompositeSpec(
  specPath: string,
  outputDir: string,
  options: Options
): Promise<void> {
  if (!options) {
    options = {}
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  try {
    const suppression = await getSuppressions(specPath)
    const docs = await getDocumentsFromCompositeSwagger(
      suppression,
      specPath,
      jsonParser.defaultErrorReport
    )
    options.consoleLogLevel = log.consoleLogLevel
    options.logFilepath = log.filepath
    const promiseFactories = docs.map(doc => async () =>
      resolveSpec(doc, outputDir, options, jsonParser.defaultErrorReport)
    )
    await utils.executePromisesSequentially(promiseFactories)
  } catch (err) {
    log.error(err)
    throw err
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
    options = {}
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  const wfGenerator = new WireFormatGenerator(specPath, null, outDir, emitYaml)
  try {
    await wfGenerator.initialize()
    log.info(`Generating wire format request and responses for swagger spec: "${specPath}":\n`)
    wfGenerator.processOperations(operationIds)
  } catch (err) {
    log.error(err)
    throw err
  }
}

export async function generateWireFormatInCompositeSpec(
  compositeSpecPath: string,
  outDir: string,
  emitYaml: unknown,
  options: Options
): Promise<void> {
  if (!options) {
    options = {}
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  try {
    const suppression = await getSuppressions(compositeSpecPath)
    const docs = await getDocumentsFromCompositeSwagger(
      suppression,
      compositeSpecPath,
      jsonParser.defaultErrorReport
    )
    options.consoleLogLevel = log.consoleLogLevel
    options.logFilepath = log.filepath
    const promiseFactories = docs.map(doc => async () =>
      generateWireFormat(doc, outDir, emitYaml, null, options)
    )
    await utils.executePromisesSequentially(promiseFactories)
  } catch (err) {
    log.error(err)
    throw err
  }
}

export async function generateUml(
  specPath: string,
  outputDir: string,
  options?: Options
): Promise<void> {
  if (!options) {
    options = {}
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  const specFileName = path.basename(specPath)
  const resolverOptions = {
    shouldResolveRelativePaths: true,
    shouldResolveXmsExamples: false,
    shouldResolveAllOf: false,
    shouldSetAdditionalPropertiesFalse: false,
    shouldResolvePureObjects: false,
    shouldResolveDiscriminator: false,
    shouldResolveParameterizedHost: false,
    shouldResolveNullableTypes: false
  }
  try {
    const suppression = await getSuppressions(specPath)
    const result = await jsonUtils.parseJson(suppression, specPath, jsonParser.defaultErrorReport)
    const resolver = new specResolver.SpecResolver(
      specPath,
      result,
      resolverOptions,
      jsonParser.defaultErrorReport
    )
    const umlGenerator = new umlGeneratorLib.UmlGenerator(resolver.specInJson, options)
    const svgGraph = await umlGenerator.generateDiagramFromGraph()
    if (outputDir !== "./" && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }
    const svgFile = specFileName.replace(path.extname(specFileName), ".svg")
    const outputFilepath = `${path.join(outputDir, svgFile)}`
    fs.writeFileSync(`${path.join(outputDir, svgFile)}`, svgGraph, {
      encoding: "utf8"
    })
    /* tslint:disable-next-line */
    console.log(`Saved the uml at "${outputFilepath}". Please open the file in a browser.`)
  } catch (err) {
    log.error(err)
    throw err
  }
}

export function updateEndResultOfSingleValidation<T extends CommonValidationResult>(
  validator: SpecValidator<T>
): void {
  if (validator.specValidationResult.validityStatus) {
    if (!(log.consoleLogLevel === "json" || log.consoleLogLevel === "off")) {
      log.info("No Errors were found.")
    }
  }
  if (!validator.specValidationResult.validityStatus) {
    process.exitCode = 1
  }
}

export function logDetailedInfo<T extends CommonValidationResult>(
  validator: SpecValidator<T>
): void {
  if (log.consoleLogLevel === "json") {
    /* tslint:disable-next-line */
    console.dir(validator.specValidationResult, { depth: null, colors: true })
  }
  log.silly("############################")
  log.silly(validator.specValidationResult.toString())
  log.silly("----------------------------")
}

export async function extractXMsExamples(
  specPath: string,
  recordings: string,
  options: Options
): Promise<StringMap<unknown>> {
  if (!options) {
    options = {}
  }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  const xMsExampleExtractor = new XMsExampleExtractor(specPath, recordings, options)
  return xMsExampleExtractor.extract()
}
