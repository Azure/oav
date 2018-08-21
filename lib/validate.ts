// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import jsYaml from "js-yaml"
import * as fs from "fs"
import * as path from "path"
import { log } from "./util/logging"
import * as utils from "./util/utils"
import {
  SpecValidator, SpecValidationResult, CommonValidationResult
} from "./validators/specValidator"
import { WireFormatGenerator } from "./wireFormatGenerator"
import { XMsExampleExtractor } from "./xMsExampleExtractor"
import { SpecResolver } from "./validators/specResolver"
import * as specResolver from "./validators/specResolver"
import * as umlGeneratorLib from "./umlGenerator"
import { getErrorsFromModelValidation } from "./util/getErrorsFromModelValidation"
import { SemanticValidator } from "./validators/semanticValidator"
import { ModelValidator } from "./validators/modelValidator"
import { MutableStringMap } from "@ts-common/string-map"

type FinalValidationResult = MutableStringMap<unknown>

export interface Options extends specResolver.Options, umlGeneratorLib.Options {
  consoleLogLevel?: unknown
  logFilepath?: unknown
  pretty?: boolean
}

export const finalValidationResult: FinalValidationResult = {
  validityStatus: true
}

export async function getDocumentsFromCompositeSwagger(
  compositeSpecPath: string
): Promise<string[]> {
  try {
    const compositeSwagger = await utils.parseJson(compositeSpecPath)
    if (!(compositeSwagger.documents
      && Array.isArray(compositeSwagger.documents)
      && compositeSwagger.documents.length > 0)) {
      throw new Error(
        `CompositeSwagger - ${compositeSpecPath} must contain a documents property and it must ` +
        `be of type array and it must be a non empty array.`)
    }
    const docs = compositeSwagger.documents
    const basePath = path.dirname(compositeSpecPath)
    const finalDocs: string[] = [];
    for (let i = 0; i < docs.length; i++) {
      if (docs[i].startsWith(".")) {
        docs[i] = docs[i].substring(1)
      }
      let individualPath = ""
      if (docs[i].startsWith("http")) {
        individualPath = docs[i]
      } else {
        individualPath = basePath + docs[i]
      }
      finalDocs.push(individualPath)
    }
    return finalDocs
  } catch (err) {
    log.error(err)
    throw err
  }
}

async function validate<T>(
  options: Options|undefined,
  func: (options: Options) => Promise<T>,
): Promise<T> {
  if (!options) { options = {} }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  if (options.pretty) {
    log.consoleLogLevel = "off"
  }
  try {
    return await func(options)
  } catch (err) {
    log.error(err)
    throw err
  }
}

export async function validateSpec(
  specPath: string,
  options: Options|undefined,
): Promise<SpecValidationResult> {
  return await validate(options, async o => {
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
    finalValidationResult[specPath] = validator.specValidationResult

    await validator.initialize()
    log.info(`Semantically validating  ${specPath}:\n`)
    await validator.validateSpec()
    updateEndResultOfSingleValidation(validator)
    logDetailedInfo(validator)
    return validator.specValidationResult
  })
}

export async function validateCompositeSpec(
  compositeSpecPath: string, options: Options
): Promise<ReadonlyArray<SpecValidationResult>> {
  return validate(options, async o => {
    const docs = await getDocumentsFromCompositeSwagger(compositeSpecPath)
    o.consoleLogLevel = log.consoleLogLevel
    o.logFilepath = log.filepath
    const promiseFactories = docs.map(doc => async () => await validateSpec(doc, o))
    return await utils.executePromisesSequentially(promiseFactories)
  })
}

export async function validateExamples(
  specPath: string, operationIds: string|undefined, options?: Options
): Promise<SpecValidationResult> {
  return await validate(options, async o => {
    const validator = new ModelValidator(specPath, null, o)
    finalValidationResult[specPath] = validator.specValidationResult
    await validator.initialize()
    log.info(`Validating "examples" and "x-ms-examples" in  ${specPath}:\n`)
    validator.validateOperations(operationIds)
    updateEndResultOfSingleValidation(validator)
    logDetailedInfo(validator)
    if (o.pretty) {
      /* tslint:disable-next-line:no-console no-string-literal */
      console.log(`Validating "examples" and "x-ms-examples" in  ${specPath}:\n`)
      const errors = getErrorsFromModelValidation(validator.specValidationResult)
      if (errors.length > 0) {
        for (const error of errors) {
          const yaml = jsYaml.dump(error)
          /* tslint:disable-next-line:no-console no-string-literal */
          console.error("\x1b[31m", "error:", "\x1b[0m")
          /* tslint:disable-next-line:no-console no-string-literal */
          console.error(yaml)
        }
      }
    }
    return validator.specValidationResult
  })
}

export async function validateExamplesInCompositeSpec(
  compositeSpecPath: string,
  options: Options
): Promise<ReadonlyArray<SpecValidationResult>> {
  return await validate(options, async o => {
    o.consoleLogLevel = log.consoleLogLevel
    o.logFilepath = log.filepath
    const docs = await getDocumentsFromCompositeSwagger(compositeSpecPath)
    const promiseFactories = docs.map(
      doc => async () => await validateExamples(doc, undefined, o))
    return await utils.executePromisesSequentially(promiseFactories)
  })
}

export async function resolveSpec(
  specPath: string, outputDir: string, options: Options
): Promise<void> {

  if (!options) { options = {} }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  const specFileName = path.basename(specPath)
  try {
    const result = await utils.parseJson(specPath)
    const resolver = new SpecResolver(specPath, result, options)
    const resolvedSwagger = JSON.stringify(resolver.specInJson, null, 2)
    if (outputDir !== "./" && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }
    const outputFilepath = `${path.join(outputDir, specFileName)}`
    fs.writeFileSync(`${path.join(outputDir, specFileName)}`, resolvedSwagger, { encoding: "utf8" })
    /* tslint:disable-next-line */
    console.log(`Saved the resolved spec at "${outputFilepath}".`)
  } catch (err) {
    log.error(err)
    throw err
  }
}

export async function resolveCompositeSpec(
  specPath: string, outputDir: string, options: Options
): Promise<void> {

  if (!options) { options = {} }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  try {
    const docs = await getDocumentsFromCompositeSwagger(specPath)
    options.consoleLogLevel = log.consoleLogLevel
    options.logFilepath = log.filepath
    const promiseFactories = docs.map(doc => async () => await resolveSpec(doc, outputDir, options))
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
  operationIds: string|null,
  options: Options
): Promise<void> {

  if (!options) { options = {} }
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
  compositeSpecPath: string, outDir: string, emitYaml: unknown, options: Options
): Promise<void> {

  if (!options) { options = {} }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  try {
    const docs = await getDocumentsFromCompositeSwagger(compositeSpecPath)
    options.consoleLogLevel = log.consoleLogLevel
    options.logFilepath = log.filepath
    const promiseFactories = docs.map(doc =>
      async () => await generateWireFormat(doc, outDir, emitYaml, null, options))
    await utils.executePromisesSequentially(promiseFactories)
  } catch (err) {
    log.error(err)
    throw err
  }
}

export async function generateUml(
  specPath: string, outputDir: string, options?: Options
): Promise<void> {

  if (!options) { options = {} }
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
    const result = await utils.parseJson(specPath)
    const resolver = new SpecResolver(specPath, result, resolverOptions)
    const umlGenerator = new umlGeneratorLib.UmlGenerator(resolver.specInJson, options)
    const svgGraph = await umlGenerator.generateDiagramFromGraph()
    if (outputDir !== "./" && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir)
    }
    const svgFile = specFileName.replace(path.extname(specFileName), ".svg")
    const outputFilepath = `${path.join(outputDir, svgFile)}`
    fs.writeFileSync(`${path.join(outputDir, svgFile)}`, svgGraph, { encoding: "utf8" })
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
    finalValidationResult.validityStatus = validator.specValidationResult.validityStatus
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
  specPath: string, recordings: string, options: Options
): Promise<void> {

  if (!options) { options = {} }
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel
  log.filepath = options.logFilepath || log.filepath
  const xMsExampleExtractor = new XMsExampleExtractor(specPath, recordings, options)
  return await xMsExampleExtractor.extract()
}
