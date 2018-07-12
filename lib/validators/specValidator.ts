// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as path from "path"
import * as Sway from "yasway"
import * as msRest from "ms-rest"
import { SpecResolver } from "./specResolver"
import * as specResolver from "./specResolver"
import * as utils from "../util/utils"
import { log } from "../util/logging"
import { CommonError } from "../util/error"
import { Unknown } from "../util/unknown"
import * as C from "../util/constants"
import { Operation, SwaggerObject } from "yasway"

const HttpRequest = msRest.WebResource

const ErrorCodes = C.ErrorCodes;

export interface Options extends specResolver.Options {
  readonly isPathCaseSensitive?: boolean
}

export interface ErrorCode {
  readonly name: string
  readonly id: string
}

export interface RequestValidation {
  request?: Unknown
  validationResult?: Sway.Validation
}

interface ResponseValidation {
  readonly [name: string]: Sway.Validation
}

export interface ValidationResult {
  exampleNotFound?: CommonError
  scenarios?: Scenarios
  readonly requestValidation?: RequestValidation
  readonly responseValidation?: ResponseValidation
}

export interface Scenarios {
  [name: string]: ValidationResult
}

export interface Result {
  isValid?: Unknown
  error?: CommonError
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
      ["x-ms-examples"]?: OperationResult
      [name: string]: OperationResult|undefined
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

export interface CommonValidationResult {
  validityStatus: Unknown
  operations: {}
  resolveSpec?: Unknown
}

/*
 * @class
 * Performs semantic and data validation of the given swagger spec.
 */
export class SpecValidator<T extends CommonValidationResult> {

  public specValidationResult: T // SpecValidationResult

  protected swaggerApi: Sway.SwaggerApi|null

  protected specPath: string

  protected sampleRequest: Unknown

  protected sampleResponse: Unknown

  private specDir: Unknown

  private specInJson: SwaggerObject

  private specResolver: SpecResolver|null

  private options: Options

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
    const base: CommonValidationResult = { validityStatus: true, operations: {} }
    this.specValidationResult = base as T
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
  protected constructErrorObject(
    code: ErrorCode,
    message: string,
    innerErrors?: null|CommonError[],
    skipValidityStatusUpdate?: boolean
  ): CommonError {

    const err: CommonError = {
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

  protected getProviderNamespace(): string|null {
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
  protected updateValidityStatus(value?: boolean): void {
    this.specValidationResult.validityStatus = Boolean(value)
  }

  protected constructRequestResult(
    operationResult: OperationResult,
    isValid: Unknown,
    msg: string,
    requestValidationErrors?: CommonError[]|null,
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

  protected constructResponseResult(
    operationResult: OperationResult,
    responseStatusCode: string,
    isValid: Unknown,
    msg: string,
    responseValidationErrors?: CommonError[]|null,
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

  /*
   * Validates the request for an operation.
   *
   * @param {object} operation - The operation object.
   *
   * @param {object} exampleParameterValues - The example parameter values.
   *
   * @return {object} result - The validation result.
   */
  protected validateRequest(
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
      errors: CommonError[]
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
}
