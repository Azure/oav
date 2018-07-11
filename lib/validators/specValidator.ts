﻿// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable-next-line:no-reference */
/// <reference path="./../../types/yasway.d.ts" />

import * as util from "util"
import * as path from "path"
import * as Sway from "yasway"
import * as msRest from "ms-rest"
import { SpecResolver } from "./specResolver"
import * as specResolver from "./specResolver"
import * as utils from "../util/utils"
import { log } from "../util/logging"
import { ResponseWrapper } from "../models/responseWrapper"
import { validateResponse } from "../util/validationResponse"
import { Error } from "../util/error"
import { Unknown } from "../util/unknown"
import * as C from "../util/constants"
import { Operation, SwaggerObject } from "yasway"
import { StringMap } from "../util/stringMap"

const HttpRequest = msRest.WebResource

const ErrorCodes = C.ErrorCodes;

export interface Options extends specResolver.Options {
  readonly isPathCaseSensitive?: boolean
}

export interface ErrorCode {
  readonly name: string
  readonly id: string
}

interface RequestValidation {
  request?: Unknown
  validationResult?: Sway.Validation
}

interface ResponseValidation {
  readonly [name: string]: Sway.Validation
}

interface ValidationResult {
  exampleNotFound?: Error
  scenarios?: Scenarios
  readonly requestValidation?: RequestValidation
  readonly responseValidation?: ResponseValidation
}

interface Scenarios {
  [name: string]: ValidationResult
}

export interface Result {
  isValid?: Unknown
  error?: Error
  warning?: Unknown
  result?: Unknown
  errors?: Unknown
  warnings?: Unknown
}

export interface SpecScenarios {
  [name: string]: OperationResult
}

export interface OperationResult {
  isValid?: Unknown
  scenarios?: SpecScenarios
  error?: Unknown
  request?: Result
  responses?: {
    [name: string]: Result
  }
}

export interface SpecValidationResult {
  resolveSpec?: Unknown
  validityStatus: Unknown
  operations: {
    [name: string]: {
      [name: string]: OperationResult
    }
  }
  validateSpec?: Result
  initialize?: Unknown
}

export interface ExampleResponse {
  readonly headers: {
    [name: string]: Unknown
  }
  readonly body: Unknown
}

/*
 * @class
 * Performs semantic and data validation of the given swagger spec.
 */
export class SpecValidator {

  public specValidationResult: SpecValidationResult

  private specPath: string

  private specDir: Unknown

  private specInJson: SwaggerObject

  private specResolver: SpecResolver|null

  private swaggerApi: Sway.SwaggerApi|null

  private options: Options

  private sampleRequest: Unknown

  private sampleResponse: Unknown

  /*
   * @constructor
   * Initializes a new instance of the SpecValidator class.
   *
   * @param {string} specPath the (remote|local) swagger spec path
   *
   * @param {object} [specInJson] the parsed spec in json format
   *
   * @param {object} [options.shouldResolveRelativePaths] Should relative paths be resolved?
   * Default: true
   *
   * @param {object} [options.shouldResolveXmsExamples] Should x-ms-examples be resolved?
   * Default: true.
   * If options.shouldResolveRelativePaths is false then this option will also be false implicitly
   * and cannot be overridden.
   *
   * @param {object} [options.shouldResolveAllOf] Should allOf references be resolved? Default: true
   *
   * @param {object} [options.shouldResolveDiscriminator] Should discriminator be resolved?
   * Default: true
   *
   * @param {object} [options.shouldSetAdditionalPropertiesFalse] Should additionalProperties be
   * set to false? Default: true
   *
   * @param {object} [options.shouldResolvePureObjects] Should pure objects be resolved?
   * Default: true
   *
   * @param {object} [options.shouldResolveParameterizedHost] Should 'x-ms-parameterized-host' be
   * resolved? Default: true
   *
   * @param {object} [options.shouldResolveNullableTypes] Should we allow null values to match any
   * type? Default: true
   *
   * @param {object} [options.isPathCaseSensitive] Specifies if the paths should be considered case
   * sensitive. Default: true
   *
   * @return {object} An instance of the SpecValidator class.
   */
  constructor(specPath: string, specInJson: SwaggerObject|undefined|null, options: Options) {
    if (specPath === null
      || specPath === undefined
      || typeof specPath.valueOf() !== "string"
      || !specPath.trim().length) {
      throw new Error(
        "specPath is a required parameter of type string and it cannot be an empty string.")
    }
    // If the spec path is a url starting with https://github then let us auto convert it to an
    // https://raw.githubusercontent url.
    if (specPath.startsWith("https://github")) {
      specPath = specPath.replace(
        /^https:\/\/(github.com)(.*)blob\/(.*)/ig, "https://raw.githubusercontent.com$2$3")
    }
    this.specPath = specPath
    this.specDir = path.dirname(this.specPath)
    this.specInJson = specInJson as SwaggerObject
    this.specResolver = null
    this.specValidationResult = { validityStatus: true, operations: {} }
    this.swaggerApi = null
    if (!options) { options = {} }
    if (options.shouldResolveRelativePaths === null
      || options.shouldResolveRelativePaths === undefined) {
      options.shouldResolveRelativePaths = true
    }

    this.options = options
    this.sampleRequest = {}
    this.sampleResponse = {}
  }

  /*
   * Initializes the spec validator. Resolves the spec on different counts using the SpecResolver
   * and initializes the internal api validator.
   */
  public async initialize(): Promise<Sway.SwaggerApi> {
    if (this.options.shouldResolveRelativePaths) {
      utils.clearCache()
    }
    try {
      if (this.specInJson === undefined || this.specInJson === null) {
        const result = await utils.parseJson(this.specPath)
        this.specInJson = result
      }

      this.specResolver = new SpecResolver(this.specPath, this.specInJson, this.options)
      this.specInJson = (await this.specResolver.resolve()).specInJson

      const options = {
        definition: this.specInJson,
        jsonRefs: {
          relativeBase: this.specDir
        },
        isPathCaseSensitive: this.options.isPathCaseSensitive
      }
      const api = await Sway.create(options)
      this.swaggerApi = api
      return api
    } catch (err) {
      const e = this.constructErrorObject(ErrorCodes.ResolveSpecError, err.message, [err])
      this.specValidationResult.resolveSpec = e
      log.error(`${ErrorCodes.ResolveSpecError.name}: ${err.message}.`)
      log.error(err.stack)
      throw e
    }
  }

  public async validateSpec(): Promise<Sway.Validation> {
    this.specValidationResult.validateSpec = {
      isValid: true,
      errors: [],
      warnings: [],
    }
    if (!this.swaggerApi) {
      const msg =
        `Please call "specValidator.initialize()" before calling this method, ` +
        `so that swaggerApi is populated.`
      const e = this.constructErrorObject(ErrorCodes.InitializationError, msg)
      this.specValidationResult.initialize = e
      this.specValidationResult.validateSpec.isValid = false
      log.error(`${ErrorCodes.InitializationError.name}: ${msg}`)
      throw e
    }
    try {
      const validationResult = this.swaggerApi.validate()
      if (validationResult) {
        if (validationResult.errors && validationResult.errors.length) {
          this.specValidationResult.validateSpec.isValid = false
          const e = this.constructErrorObject(
            ErrorCodes.SemanticValidationError,
            `The spec ${this.specPath} has semantic validation errors.`,
            validationResult.errors)
          this.specValidationResult.validateSpec.errors = validateResponse.constructErrors(
            e, this.specPath, this.getProviderNamespace())
          log.error(C.Errors)
          log.error("------")
          this.updateValidityStatus()
          log.error(e as any)
        } else {
          this.specValidationResult.validateSpec.result =
            `The spec ${this.specPath} is semantically valid.`
        }
        if (validationResult.warnings && validationResult.warnings.length > 0) {
          const warnings = validateResponse.sanitizeWarnings(validationResult.warnings)
          if (warnings && warnings.length) {
            this.specValidationResult.validateSpec.warnings = warnings
            log.debug(C.Warnings)
            log.debug("--------")
            log.debug(util.inspect(warnings))
          }
        }
      }
      return validationResult
    } catch (err) {
      const msg =
        `An Internal Error occurred in validating the spec "${this.specPath}". \t${err.message}.`
      err.code = ErrorCodes.InternalError.name
      err.id = ErrorCodes.InternalError.id
      err.message = msg
      this.specValidationResult.validateSpec.isValid = false
      this.specValidationResult.validateSpec.error = err
      log.error(err)
      this.updateValidityStatus()
      throw err
    }
  }

  /*
   * Validates the given operationIds or all the operations in the spec.
   *
   * @param {string} [operationIds] - A comma separated string specifying the operations to be
   * validated.
   * If not specified then the entire spec is validated.
   */
  public validateOperations(operationIds?: string): void {
    if (!this.swaggerApi) {
      throw new Error(
        `Please call "specValidator.initialize()" before calling this method, so that swaggerApi ` +
        `is populated.`)
    }
    if (operationIds !== null
      && operationIds !== undefined
      && typeof operationIds.valueOf() !== "string") {
      throw new Error(`operationIds parameter must be of type 'string'.`)
    }

    let operations = this.swaggerApi.getOperations()
    if (operationIds) {
      const operationIdsObj: { [name: string]: Unknown } = {}
      operationIds.trim().split(",").forEach(item => operationIdsObj[item.trim()] = 1)
      const operationsToValidate = operations
        .filter(item => Boolean(operationIdsObj[item.operationId]))
      if (operationsToValidate.length) { operations = operationsToValidate }
    }

    for (const operation of operations) {
      this.specValidationResult.operations[operation.operationId] = {
        [C.xmsExamples]: {},
        [C.exampleInSpec]: {}
      }
      this.validateOperation(operation)
      if (utils
          .getKeys(
            this.specValidationResult.operations
            [operation.operationId]
            [C.exampleInSpec])
          .length
        === 0) {
        delete this.specValidationResult.operations[operation.operationId][C.exampleInSpec]
      }
    }
  }

  private getProviderNamespace(): string|null {
    const re = /^(.*)\/providers\/(\w+\.\w+)\/(.*)$/ig
    if (this.specInJson) {
      if (this.specInJson.paths) {
        const paths = utils.getKeys(this.specInJson.paths)
        if (paths) {
          for (const pathStr of paths) {
            const res = re.exec(pathStr)
            if (res && res[2]) {
              return res[2]
            }
          }
        }
      }
    }
    return null
  }

  /*
   * Updates the validityStatus of the internal specValidationResult based on the provided value.
   *
   * @param {boolean} value
   */
  private updateValidityStatus(value?: boolean): void {
    this.specValidationResult.validityStatus = Boolean(value)
  }

  /*
   * Constructs the Error object and updates the validityStatus unless indicated to not update the
   * status.
   *
   * @param {string} code The Error code that uniquely identifiers the error.
   *
   * @param {string} message The message that provides more information about the error.
   *
   * @param {array} [innerErrors] An array of Error objects that specify inner details.
   *
   * @param {boolean} [skipValidityStatusUpdate] When specified a truthy value it will skip updating
   *    the validity status.
   *
   * @return {object} err Return the constructed Error object.
   */
  private constructErrorObject(
    code: ErrorCode,
    message: string,
    innerErrors?: null|Error[],
    skipValidityStatusUpdate?: boolean
  ): Error {

    const err: Error = {
      code: code.name,
      id: code.id,
      message: message,
      innerErrors: innerErrors ? innerErrors : undefined
    }
    if (!skipValidityStatusUpdate) {
      this.updateValidityStatus()
    }
    return err
  }

  private initializeExampleResult(
    operationId: string, exampleType: string, scenarioName: string|undefined
  ): void {
    const initialResult = {
      isValid: true,
      request: {
        isValid: true
      },
      responses: {}
    }
    let operationResult = this.specValidationResult.operations[operationId]
    if (!operationResult) {
      operationResult = {}
    }
    if (exampleType === C.exampleInSpec) {
      if (!operationResult[exampleType] ||
        (operationResult[exampleType] && !utils.getKeys(operationResult[exampleType]).length)) {
        operationResult[exampleType] = initialResult
      }
    }

    if (exampleType === C.xmsExamples) {
      const o = operationResult[exampleType]
      if (!o.scenarios) {
        o.scenarios = {}
      }
      if (scenarioName === undefined) {
        throw new Error("scenarioName === undefined")
      }
      if (!o.scenarios[scenarioName]) {
        o.scenarios[scenarioName] = initialResult
      }
    }
    this.specValidationResult.operations[operationId] = operationResult
  }

  private constructRequestResult(
    operationResult: OperationResult,
    isValid: Unknown,
    msg: string,
    requestValidationErrors?: Error[]|null,
    requestValidationWarnings?: Unknown
  ): void {

    if (operationResult.request === undefined) {
      throw new Error("operationResult.result is undefined")
    }

    if (!isValid) {
      operationResult.isValid = false
      operationResult.request.isValid = false
      const e = this.constructErrorObject(
        ErrorCodes.RequestValidationError, msg, requestValidationErrors)
      operationResult.request.error = e
      log.error(`${msg}:\n`, e)
    } else if (requestValidationWarnings) {
      operationResult.request.warning = requestValidationWarnings
      log.debug(`${msg}:\n`, requestValidationWarnings)
    } else {
      operationResult.request.isValid = true
      operationResult.request.result = msg
      log.info(`${msg}`)
    }
  }

  private constructResponseResult(
    operationResult: OperationResult,
    responseStatusCode: string,
    isValid: Unknown,
    msg: string,
    responseValidationErrors?: Error[]|null,
    responseValidationWarnings?: Unknown
  ): void {

    if (operationResult.responses === undefined) {
      throw new Error("operationResult.responses is undefined")
    }
    if (!operationResult.responses[responseStatusCode]) {
      operationResult.responses[responseStatusCode] = {}
    }
    if (!isValid) {
      operationResult.isValid = false
      operationResult.responses[responseStatusCode].isValid = false
      const e = this.constructErrorObject(
        ErrorCodes.ResponseValidationError, msg, responseValidationErrors)
      operationResult.responses[responseStatusCode].error = e
      log.error(`${msg}:\n`, e)
    } else if (responseValidationWarnings) {
      operationResult.responses[responseStatusCode].warning = responseValidationWarnings
      log.debug(`${msg}:\n`, responseValidationWarnings)
    } else {
      operationResult.responses[responseStatusCode].isValid = true
      operationResult.responses[responseStatusCode].result = msg
      log.info(`${msg}`)
    }
  }

  private constructRequestResultWrapper(
    operationId: string,
    requestValidationErrors: Error[],
    requestValidationWarnings: Unknown[]|undefined,
    exampleType: string,
    scenarioName?: string
  ): void {

    this.initializeExampleResult(operationId, exampleType, scenarioName)
    let operationResult
    let part
    let subMsg
    let infoMsg
    let errorMsg
    let warnMsg
    if (exampleType === C.xmsExamples) {
      const scenarios =
        this.specValidationResult.operations[operationId][exampleType].scenarios as SpecScenarios
      operationResult = scenarios[scenarioName as string]
      part = `for x-ms-example "${scenarioName}" in operation "${operationId}"`
    } else {
      operationResult = this.specValidationResult.operations[operationId][exampleType]
      part = `for example in spec for operation "${operationId}"`
    }
    subMsg = `validating the request ${part}`
    infoMsg = `Request parameters ${part} is valid.`
    if (requestValidationErrors && requestValidationErrors.length) {
      errorMsg = `Found errors in ${subMsg}.`
      this.constructRequestResult(operationResult, false, errorMsg, requestValidationErrors)
    } else {
      this.constructRequestResult(operationResult, true, infoMsg)
    }
    if (requestValidationWarnings && requestValidationWarnings.length) {
      warnMsg = `Found warnings in ${subMsg}.`
      this.constructRequestResult(operationResult, true, warnMsg, null, requestValidationWarnings)
    }
  }

  private constructResponseResultWrapper(
    operationId: string,
    responseStatusCode: string,
    responseValidationErrors: Error[],
    responseValidationWarnings: Unknown[]|undefined,
    exampleType: string,
    scenarioName?: string
  ): void {

    this.initializeExampleResult(operationId, exampleType, scenarioName)
    let operationResult
    let part
    let subMsg
    let infoMsg
    let errorMsg
    let warnMsg
    if (exampleType === C.xmsExamples) {
      const scenarios =
        this.specValidationResult.operations[operationId][exampleType].scenarios as SpecScenarios
      operationResult = scenarios[scenarioName as string]
      part = `for x-ms-example "${scenarioName}" in operation "${operationId}"`
    } else {
      operationResult = this.specValidationResult.operations[operationId][exampleType]
      part = `for example in spec for operation "${operationId}"`
    }
    subMsg = `validating the response with statusCode "${responseStatusCode}" ${part}`
    infoMsg = `Response with statusCode "${responseStatusCode}" ${part} is valid.`
    if (responseValidationErrors && responseValidationErrors.length) {
      errorMsg = `Found errors in ${subMsg}.`
      this.constructResponseResult(
        operationResult, responseStatusCode, false, errorMsg, responseValidationErrors)
    } else {
      this.constructResponseResult(operationResult, responseStatusCode, true, infoMsg)
    }
    if (responseValidationWarnings && responseValidationWarnings.length) {
      warnMsg = `Found warnings in ${subMsg}.`
      this.constructResponseResult(
        operationResult, responseStatusCode, true, warnMsg, null, responseValidationWarnings)
    }
  }

  /*
   * Constructs the validation result for an operation.
   *
   * @param {object} operation - The operation object.
   *
   * @param {object} result - The validation result that needs to be added to the uber
   * validationResult object for the entire spec.
   *
   * @param {string} exampleType A string specifying the type of example. "x-ms-example",
   *    "example-in-spec".
   *
   * @return {object} xmsExample - The xmsExample object.
   */
  private constructOperationResult(
    operation: Operation, result: ValidationResult, exampleType: string
  ): void {

    const operationId = operation.operationId
    if (result.exampleNotFound) {
      this.specValidationResult.operations[operationId][exampleType].error = result.exampleNotFound
      // log.error(result.exampleNotFound)
    }
    if (exampleType === C.xmsExamples) {
      if (result.scenarios) {
        for (const scenario of utils.getKeys(result.scenarios)) {
          const requestValidation = result.scenarios[scenario].requestValidation
          if (requestValidation === undefined) {
            throw new Error("requestValidation is undefined")
          }
          const validationResult = requestValidation.validationResult
          if (validationResult === undefined) {
            throw new Error("validationResult is undefined")
          }
          // requestValidation
          const requestValidationErrors = validationResult.errors
          const requestValidationWarnings = validationResult.warnings
          this.constructRequestResultWrapper(
            operationId, requestValidationErrors, requestValidationWarnings, exampleType, scenario)
          // responseValidation
          const responseValidation = result.scenarios[scenario].responseValidation
          if (responseValidation === undefined) {
            throw new Error("responseValidation is undefined")
          }
          for (const responseStatusCode of utils.getKeys(responseValidation)) {
            const responseValidationErrors = responseValidation[responseStatusCode].errors
            const responseValidationWarnings = responseValidation[responseStatusCode].warnings
            this.constructResponseResultWrapper(
              operationId,
              responseStatusCode,
              responseValidationErrors,
              responseValidationWarnings,
              exampleType,
              scenario)
          }
        }
      }
    } else if (exampleType === C.exampleInSpec) {
      if (result.requestValidation && utils.getKeys(result.requestValidation).length) {
        // requestValidation
        const validationResult = result.requestValidation.validationResult
        if (validationResult === undefined) {
          throw new Error("validationResult is undefined")
        }
        const requestValidationErrors = validationResult.errors
        const requestValidationWarnings = validationResult.warnings
        this.constructRequestResultWrapper(
          operationId, requestValidationErrors, requestValidationWarnings, exampleType)
      }
      if (result.responseValidation && utils.getKeys(result.responseValidation).length) {
        // responseValidation
        for (const responseStatusCode of utils.getKeys(result.responseValidation)) {
          const responseValidationErrors = result.responseValidation[responseStatusCode].errors
          const responseValidationWarnings = result.responseValidation[responseStatusCode].warnings
          this.constructResponseResultWrapper(
            operationId,
            responseStatusCode,
            responseValidationErrors,
            responseValidationWarnings,
            exampleType)
        }
      }
    }
  }

  /*
   * Validates the given operation.
   *
   * @param {object} operation - The operation object.
   */
  private validateOperation(operation: Operation): void {
    this.validateXmsExamples(operation)
    this.validateExample(operation)
  }

  /*
   * Validates the x-ms-examples object for an operation if specified in the swagger spec.
   *
   * @param {object} operation - The operation object.
   */
  private validateXmsExamples(operation: Operation): void {
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }
    const xmsExamples = operation[C.xmsExamples]
    const resultScenarios: Scenarios = {}
    const result: ValidationResult = {
      scenarios: resultScenarios
    }
    if (xmsExamples) {
      for (const scenario of Object.keys(xmsExamples)) {
        const xmsExample = xmsExamples[scenario]
        resultScenarios[scenario] = {
          requestValidation: this.validateRequest(operation, xmsExample.parameters),
          responseValidation: this.validateXmsExampleResponses(operation, xmsExample.responses)
        }
      }
      result.scenarios = resultScenarios
    } else {
      const msg = `x-ms-example not found in ${operation.operationId}.`
      result.exampleNotFound = this.constructErrorObject(
        ErrorCodes.XmsExampleNotFoundError, msg, null, true)
    }
    this.constructOperationResult(operation, result, C.xmsExamples)
  }

  /*
   * Validates the example provided in the spec for the given operation if specified in the spec.
   *
   * @param {object} operation - The operation object.
   */
  private validateExample(operation: Operation): void {
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }
    const result: ValidationResult = {
      requestValidation: this.validateExampleRequest(operation),
      responseValidation: this.validateExampleResponses(operation) as any
    }
    this.constructOperationResult(operation, result, C.exampleInSpec)
  }

  /*
   * Validates the request for an operation.
   *
   * @param {object} operation - The operation object.
   *
   * @param {object} exampleParameterValues - The example parameter values.
   *
   * @return {object} result - The validation result.
   */
  private validateRequest(
    operation: Operation, exampleParameterValues: { [name: string]: string }
  ): RequestValidation {

    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }

    if (exampleParameterValues === null
      || exampleParameterValues === undefined
      || typeof exampleParameterValues !== "object") {
      throw new Error(
        `In operation "${operation.operationId}", exampleParameterValues cannot be null or ` +
        `undefined and must be of type "object" (A dictionary of key-value pairs of ` +
        `parameter-names and their values).`)
    }

    const parameters = operation.getParameters()
    const result: RequestValidation = {
      request: null,
      validationResult: { errors: [], warnings: [] }
    }
    let foundIssues = false
    const options: {
      baseUrl?: string
      [name: string]: any
    } = { headers: {} }
    let formDataFiles: {
      [name: string]: Unknown
    }|null = null
    const pathObject = operation.pathObject as Sway.PathObject
    const parameterizedHost = pathObject.api[C.xmsParameterizedHost]
    const hostTemplate = parameterizedHost && parameterizedHost.hostTemplate
      ? parameterizedHost.hostTemplate
      : null
    if (operation.pathObject
      && operation.pathObject.api
      && (operation.pathObject.api.host || hostTemplate)) {
      let scheme = "https"
      let basePath = ""
      let host = ""
      host = operation.pathObject.api.host || hostTemplate
      if (host.endsWith("/")) {
        host = host.slice(0, host.length - 1)
      }
      if (operation.pathObject.api.schemes
        && !operation.pathObject.api.schemes.some(
          item => !!item && item.toLowerCase() === "https")) {
        scheme = operation.pathObject.api.schemes[0]
      }
      if (operation.pathObject.api.basePath) {
        basePath = operation.pathObject.api.basePath
      }
      if (!basePath.startsWith("/")) {
        basePath = `/${basePath}`
      }
      let baseUrl = ""
      if (host.startsWith(scheme + "://")) {
        baseUrl = `${host}${basePath}`
      } else {
        baseUrl = `${scheme}://${host}${basePath}`
      }
      options.baseUrl = baseUrl
    }
    options.method = operation.method
    let pathTemplate = pathObject.path
    if (pathTemplate && pathTemplate.includes("?")) {
      pathTemplate = pathTemplate.slice(0, pathTemplate.indexOf("?"))
      pathObject.path = pathTemplate
    }
    options.pathTemplate = pathTemplate
    for (const parameter of parameters) {
      let parameterValue = exampleParameterValues[parameter.name]
      if (!parameterValue) {
        if (parameter.required) {
          const msg =
            `In operation "${operation.operationId}", parameter ${parameter.name} is required in ` +
            `the swagger spec but is not present in the provided example parameter values.`
          const e = this.constructErrorObject(ErrorCodes.RequiredParameterExampleNotFound, msg)
          if (result.validationResult === undefined) {
            throw new Error("result.validationResult is undefined")
          }
          result.validationResult.errors.push(e)
          foundIssues = true
          break
        }
        continue
      }
      const location = parameter.in
      if (location === "path" || location === "query") {
        if (location === "path" && parameterValue && typeof parameterValue === "string") {
          // "/{scope}/scopes/resourceGroups/{resourceGroupName}" In the aforementioned path
          // template, we will search for the path parameter based on it's name
          // for example: "scope". Find it's index in the string and move backwards by 2 positions.
          // If the character at that position is a forward slash "/" and
          // the value for the parameter starts with a forward slash "/" then we have found the case
          // where there will be duplicate forward slashes in the url.
          if (pathTemplate.charAt(pathTemplate.indexOf(`${parameter.name}`) - 2)
            === "/" && parameterValue.startsWith("/")) {

            const msg =
              `In operation "${operation.operationId}", example for parameter ` +
              `"${parameter.name}": "${parameterValue}" starts with a forward slash ` +
              `and the path template: "${pathTemplate}" contains a forward slash before ` +
              `the parameter starts. This will cause double forward slashes ` +
              ` in the request url. Thus making it incorrect. Please rectify the example.`
            const e = this.constructErrorObject(ErrorCodes.DoubleForwardSlashesInUrl, msg)
            if (result.validationResult === undefined) {
              throw new Error("result.validationResult is undefined")
            }
            result.validationResult.errors.push(e)
            foundIssues = true
            break
          }
          // replacing forward slashes with empty string because this messes up Sways regex
          // validation of path segment.
          parameterValue = parameterValue.replace(/\//ig, "")
        }
        const paramType = location + "Parameters"
        if (!options[paramType]) { options[paramType] = {} }
        if (parameter[C.xmsSkipUrlEncoding] || utils.isUrlEncoded(parameterValue)) {
          options[paramType][parameter.name] = {
            value: parameterValue,
            skipUrlEncoding: true
          }
        } else {
          options[paramType][parameter.name] = parameterValue
        }
      } else if (location === "body") {
        options.body = parameterValue
        options.disableJsonStringifyOnBody = true
        if (operation.consumes) {
          const isOctetStream = (consumes: string[]) => consumes.some(
            contentType => contentType === "application/octet-stream")

          options.headers["Content-Type"] =
            parameter.schema.format === "file" && isOctetStream(operation.consumes)
              ? "application/octet-stream"
              : operation.consumes[0]
        }
      } else if (location === "header") {
        options.headers[parameter.name] = parameterValue
      } else if (location === "formData") {
        // helper function
        const isFormUrlEncoded = (consumes: string[]) => consumes.some(
          contentType => contentType === "application/x-www-form-urlencoded")

        if (!options.formData) { options.formData = {} }
        options.formData[parameter.name] = parameterValue

        // set Content-Type correctly
        if (operation.consumes && isFormUrlEncoded(operation.consumes)) {
          options.headers["Content-Type"] = "application/x-www-form-urlencoded"
        } else {
          // default to formData
          options.headers["Content-Type"] = "multipart/form-data"
        }
        // keep track of parameter type 'file' as sway expects such parameter types to be set
        // differently in the request object given for validation.
        if (parameter.type === "file") {
          if (!formDataFiles) { formDataFiles = {} }
          formDataFiles[parameter.name] = parameterValue
        }
      }
    }

    if (options.headers["content-type"]) {
      const val = delete options.headers["content-type"]
      options.headers["Content-Type"] = val
    }
    if (!options.headers["Content-Type"]) {
      options.headers["Content-Type"] = utils.getJsonContentType(operation.consumes)
    }

    let request: msRest.WebResource|null = null
    let validationResult: {
      errors: Error[]
    } = {
      errors: []
    }
    if (!foundIssues) {
      try {
        request = new HttpRequest()
        request = request.prepare(options as any)
        // set formData in the way sway expects it.
        if (formDataFiles) {
          (request as any).files = formDataFiles
        } else if (options.formData) {
          request.body = options.formData
        }
        validationResult = operation.validateRequest(request)
        this.sampleRequest = request
      } catch (err) {
        request = null
        const e = this.constructErrorObject(ErrorCodes.ErrorInPreparingRequest, err.message, [err])
        validationResult.errors.push(e)
      }
    }

    result.request = request
    result.validationResult = utils.mergeObjects(validationResult, result.validationResult as any)
    return result
  }

  /*
   * Validates the response for an operation.
   *
   * @param {object} operationOrResponse - The operation or the response object.
   *
   * @param {object} responseWrapper - The example responseWrapper.
   *
   * @return {object} result - The validation result.
   */
  private validateResponse(operationOrResponse: Operation, responseWrapper: Unknown) {
    const self = this
    if (operationOrResponse === null
      || operationOrResponse === undefined
      || typeof operationOrResponse !== "object") {
      throw new Error(
        "operationOrResponse cannot be null or undefined and must be of type 'object'.")
    }

    if (responseWrapper === null
      || responseWrapper === undefined
      || typeof responseWrapper !== "object") {
      throw new Error("responseWrapper cannot be null or undefined and must be of type 'object'.")
    }
    self.sampleResponse = responseWrapper
    return operationOrResponse.validateResponse(responseWrapper)
  }

  /*
   * Validates the example (request) for an operation if specified in the swagger spec.
   *
   * @param {object} operation - The operation object.
   *
   * @return {object} result - The validation result.
   */
  private validateExampleRequest(operation: Operation): RequestValidation {
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }
    const parameters = operation.getParameters()
    // as per swagger specification
    // https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#fixed-fields-13
    // example can only be provided in a schema and schema can only be provided for a body
    // parameter. Hence, if the body parameter schema has an example, then we will populate sample
    // values for other parameters and create a request object.
    // This request object will be used to validate the body parameter example. Otherwise, we will
    // skip it.
    const bodyParam = parameters.find(item => item.in === "body")

    let result: RequestValidation = {}
    if (bodyParam && bodyParam.schema && bodyParam.schema.example) {
      const exampleParameterValues: { [name: string]: string } = {}
      for (const parameter of parameters) {
        log.debug(
          `Getting sample value for parameter "${parameter.name}" in operation ` +
          `"${operation.operationId}".`)
        // need to figure out how to register custom format validators. Till then deleting the
        // format uuid.
        if (parameter.format && parameter.format === "uuid") {
          delete parameter.format
          delete parameter.schema.format
        }
        exampleParameterValues[parameter.name] = parameter.getSample()
      }
      exampleParameterValues[bodyParam.name] = bodyParam.schema.example
      result = this.validateRequest(operation, exampleParameterValues)
    }
    return result
  }

  /*
   * Validates the responses given in x-ms-examples object for an operation.
   *
   * @param {object} operation - The operation object.
   *
   * @param {object} exampleResponseValue - The example response value.
   *
   * @return {object} result - The validation result.
   */
  private validateXmsExampleResponses(
    operation: Operation,
    exampleResponseValue: { [name: string]: ExampleResponse }
  ) {

    const result: {
      [name: string]: Sway.Validation
    } = {}
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }

    if (exampleResponseValue === null
      || exampleResponseValue === undefined
      || typeof exampleResponseValue !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }
    const responsesInSwagger: {
      [name: string]: Unknown
    } = {}
    operation.getResponses().forEach(response => {
      responsesInSwagger[response.statusCode] = response.statusCode
    })
    for (const exampleResponseStatusCode of utils.getKeys(exampleResponseValue)) {
      const response = operation.getResponse(exampleResponseStatusCode)
      if (responsesInSwagger[exampleResponseStatusCode]) {
        delete responsesInSwagger[exampleResponseStatusCode]
      }
      result[exampleResponseStatusCode] = { errors: [], warnings: [] }
      // have to ensure how to map negative status codes to default. There have been several issues
      // filed in the Autorest repo, w.r.t how
      // default is handled. While solving that issue, we may come up with some extension. Once that
      // is finalized, we should code accordingly over here.
      if (!response) {
        const msg =
          `Response statusCode "${exampleResponseStatusCode}" for operation ` +
          `"${operation.operationId}" is provided in exampleResponseValue, ` +
          `however it is not present in the swagger spec.`;
        const e = this.constructErrorObject(ErrorCodes.ResponseStatusCodeNotInSpec, msg)
        result[exampleResponseStatusCode].errors.push(e)
        log.error(e as any)
        continue
      }

      const exampleResponseHeaders = exampleResponseValue[exampleResponseStatusCode].headers || {}
      const exampleResponseBody = exampleResponseValue[exampleResponseStatusCode].body
      if (exampleResponseBody && !response.schema) {
        const msg =
          `Response statusCode "${exampleResponseStatusCode}" for operation ` +
          `"${operation.operationId}" has response body provided in the example, ` +
          `however the response does not have a "schema" defined in the swagger spec.`
        const e = this.constructErrorObject(ErrorCodes.ResponseSchemaNotInSpec, msg)
        result[exampleResponseStatusCode].errors.push(e)
        log.error(e as any)
        continue
      }
      // ensure content-type header is present
      if (!(exampleResponseHeaders["content-type"] || exampleResponseHeaders["Content-Type"])) {
        exampleResponseHeaders["content-type"] = utils.getJsonContentType(operation.produces)
      }
      const exampleResponse = new ResponseWrapper(
        exampleResponseStatusCode, exampleResponseBody, exampleResponseHeaders)
      const validationResult = this.validateResponse(operation, exampleResponse)
      result[exampleResponseStatusCode] = validationResult
    }
    const responseWithoutXmsExamples = utils
      .getKeys(responsesInSwagger)
      .filter(statusCode => {
        if (statusCode !== "default") {
          // let intStatusCode = parseInt(statusCode);
          // if (!isNaN(intStatusCode) && intStatusCode < 400) {
          return statusCode
          // }
        }
      })
    if (responseWithoutXmsExamples && responseWithoutXmsExamples.length) {
      const msg =
        `Following response status codes "${responseWithoutXmsExamples.toString()}" for ` +
        `operation "${operation.operationId}" were present in the swagger spec, ` +
        `however they were not present in x-ms-examples. Please provide them.`
      const e = this.constructErrorObject(ErrorCodes.ResponseStatusCodeNotInExample, msg)
      log.error(e as any)
      responseWithoutXmsExamples.forEach(statusCode => result[statusCode] = { errors: [e] })
    }
    return result
  }

  /*
   * Validates the example responses for a given operation.
   *
   * @param {object} operation - The operation object.
   *
   * @return {object} result - The validation result.
   */
  private validateExampleResponses(operation: Operation): StringMap<Sway.Validation> {
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }
    const result: StringMap<Sway.Validation> = {}
    const responses = operation.getResponses()
    for (const response of responses) {
      if (response.examples) {
        for (const mimeType of Object.keys(response.examples)) {
          const exampleResponseBody = response.examples[mimeType]
          const exampleResponseHeaders = { "content-type": mimeType }
          const exampleResponse = new ResponseWrapper(
            response.statusCode, exampleResponseBody, exampleResponseHeaders)
          const validationResult = this.validateResponse(operation, exampleResponse)
          result[response.statusCode] = validationResult
        }
      }
    }
    return result
  }

}
