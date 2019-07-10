// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { MutableStringMap } from "@ts-common/string-map"
import globby from "globby"
import * as http from "http"
import * as _ from "lodash"
import * as msRest from "ms-rest"
import * as os from "os"
import * as path from "path"
import { ParsedUrlQuery } from "querystring"
import * as url from "url"
import * as util from "util"
import { Operation, Request } from "yasway"

import * as models from "../models"
import { PotentialOperationsResult } from "../models/potentialOperationsResult"
import * as C from "../util/constants"
import { log } from "../util/logging"
import { Severity } from "../util/severity"
import * as utils from "../util/utils"
import {
  ErrorCode,
  errorCodeToErrorMetadata,
  processValidationErrors,
  RuntimeException,
  SourceLocation
} from "../util/validationError"
import { SpecValidator } from "./specValidator"

export interface LiveValidatorOptions {
  swaggerPaths: string[]
  git: {
    shouldClone: boolean
    url?: string
    branch?: string
  }
  useRelativeSourceLocationUrl?: boolean
  directory: string
  swaggerPathsPattern: string
  isPathCaseSensitive: boolean
}

interface ApiVersion {
  [method: string]: Operation[]
}

interface Provider {
  [apiVersion: string]: ApiVersion
}

export interface LiveRequest extends Request {
  headers: object
  body?: object
}

export interface LiveResponse {
  statusCode: string
  headers: object
  body?: object
}

export interface RequestResponsePair {
  readonly liveRequest: LiveRequest
  readonly liveResponse: LiveResponse
}

interface OperationInfo {
  readonly operationId: string
  readonly apiVersion: string
}

export interface LiveValidationResult {
  readonly isSuccessful?: boolean
  readonly operationInfo: OperationInfo
  readonly errors: LiveValidationIssue[]
  readonly runtimeException?: RuntimeException
}

export interface RequestResponseLiveValidationResult {
  readonly requestValidationResult: LiveValidationResult
  readonly responseValidationResult: LiveValidationResult
  readonly runtimeException?: RuntimeException
}

export interface ApiOperationIdentifier {
  readonly url: string
  readonly method: string
}

export interface LiveValidationIssue {
  readonly code: ErrorCode
  readonly message: string
  readonly jsonPathsInPayload: string[]
  readonly pathsInPayload: string[]
  readonly schemaPath: string
  readonly severity: Severity
  readonly source: SourceLocation
  readonly documentationUrl: string
  readonly params?: string[]
  readonly inner?: LiveValidationIssue[]
}

/**
 * Options for a validation operation.
 * If `includeErrors` is missing or empty, all error codes will be included.
 */
export interface ValidateOptions {
  readonly includeErrors?: ErrorCode[]
}

type OperationWithApiVersion = Operation & { apiVersion: string }

/**
 * @class
 * Live Validator for Azure swagger APIs.
 */
export class LiveValidator {
  public readonly cache: MutableStringMap<Provider> = {}

  public options: LiveValidatorOptions

  /**
   * Constructs LiveValidator based on provided options.
   *
   * @param {object} ops The configuration options.
   *
   * @returns CacheBuilder Returns the configured CacheBuilder object.
   */
  public constructor(options?: Partial<LiveValidatorOptions>) {
    const ops: Partial<LiveValidatorOptions> = options || {}

    if (!ops.swaggerPaths) {
      ops.swaggerPaths = []
    }

    if (!ops.git) {
      ops.git = {
        url: "https://github.com/Azure/azure-rest-api-specs.git",
        shouldClone: false
      }
    }

    if (!ops.git.url) {
      ops.git.url = "https://github.com/Azure/azure-rest-api-specs.git"
    }
    if (!ops.git.shouldClone) {
      ops.git.shouldClone = false
    }

    if (!ops.directory) {
      ops.directory = path.resolve(os.homedir(), "repo")
    }

    if (!ops.isPathCaseSensitive) {
      ops.isPathCaseSensitive = false
    }

    this.options = ops as LiveValidatorOptions
  }

  /**
   * Initializes the Live Validator.
   */
  public async initialize(): Promise<void> {
    // Clone github repository if required
    if (this.options.git.shouldClone && this.options.git.url) {
      utils.gitClone(this.options.directory, this.options.git.url, this.options.git.branch)
    }

    // Construct array of swagger paths to be used for building a cache
    const swaggerPaths = await this.getSwaggerPaths()
    log.info(`Found ${swaggerPaths.length}`)
    const promiseFactories = swaggerPaths.map(swaggerPath => {
      return this.getSwaggerInitializer(swaggerPath)
    })

    await Promise.all(promiseFactories)
    log.info("Cache initialization complete.")
  }

  /**
   * Gets list of potential operations objects for given url and method.
   *
   * @param  requestUrl The url for which to find potential operations.
   *
   * @param requestMethod The http verb for the method to be used for lookup.
   *
   * @returns Potential operation result object.
   */
  private getPotentialOperations(
    requestUrl: string,
    requestMethod: string
  ): PotentialOperationsResult {
    if (_.isEmpty(this.cache)) {
      const msgStr =
        `Please call "liveValidator.initialize()" before calling this method, ` +
        `so that cache is populated.`
      throw new Error(msgStr)
    }

    if (
      requestUrl === null ||
      requestUrl === undefined ||
      typeof requestUrl.valueOf() !== "string" ||
      !requestUrl.trim().length
    ) {
      throw new Error(
        'requestUrl is a required parameter of type "string" and it cannot be an empty string.'
      )
    }

    if (
      requestMethod === null ||
      requestMethod === undefined ||
      typeof requestMethod.valueOf() !== "string" ||
      !requestMethod.trim().length
    ) {
      throw new Error(
        'requestMethod is a required parameter of type "string" and it cannot be an empty string.'
      )
    }

    let potentialOperations: Operation[] = []
    const parsedUrl = url.parse(requestUrl, true)
    const pathStr = parsedUrl.pathname
    requestMethod = requestMethod.toLowerCase()
    let msg
    let code
    let liveValidationError: models.LiveValidationError | undefined
    if (pathStr === null || pathStr === undefined) {
      msg = `Could not find path from requestUrl: "${requestUrl}".`
      liveValidationError = new models.LiveValidationError(
        C.ErrorCodes.PathNotFoundInRequestUrl.name,
        msg
      )
      return new models.PotentialOperationsResult(
        potentialOperations,
        C.unknownResourceProvider,
        C.unknownApiVersion,
        liveValidationError
      )
    }

    // Lower all the keys of query parameters before searching for `api-version`
    const queryObject = _.transform(
      parsedUrl.query,
      (obj: ParsedUrlQuery, value, key) => (obj[key.toLowerCase()] = value)
    )
    let apiVersion = queryObject["api-version"] as string
    let provider = utils.getProvider(pathStr)

    // Provider would be provider found from the path or Microsoft.Unknown
    provider = provider || C.unknownResourceProvider
    if (provider === C.unknownResourceProvider) {
      apiVersion = C.unknownApiVersion
    }
    provider = provider.toLowerCase()

    // Search using provider
    const allApiVersions = this.cache[provider]
    if (allApiVersions) {
      // Search using api-version found in the requestUrl
      if (apiVersion) {
        const allMethods = allApiVersions[apiVersion]
        if (allMethods) {
          const operationsForHttpMethod = allMethods[requestMethod]
          // Search using requestMethod provided by user
          if (operationsForHttpMethod) {
            // Find the best match using regex on path
            potentialOperations = this.getPotentialOperationsHelper(
              pathStr,
              requestMethod,
              operationsForHttpMethod
            )
            // If potentialOperations were to be [] then we need reason
            msg =
              `Could not find best match operation for verb "${requestMethod}" for api-version ` +
              `"${apiVersion}" and provider "${provider}" in the cache.`
            code = C.ErrorCodes.OperationNotFoundInCache
          } else {
            msg =
              `Could not find any methods with verb "${requestMethod}" for api-version ` +
              `"${apiVersion}" and provider "${provider}" in the cache.`
            code = C.ErrorCodes.OperationNotFoundInCacheWithVerb
            log.debug(msg)
          }
        } else {
          msg =
            `Could not find exact api-version "${apiVersion}" for provider "${provider}" ` +
            `in the cache.`
          code = C.ErrorCodes.OperationNotFoundInCacheWithApi
          log.debug(`${msg} We'll search in the resource provider "Microsoft.Unknown".`)
          potentialOperations = this.getPotentialOperationsHelper(pathStr, requestMethod, [])
        }
      } else {
        msg = `Could not find api-version in requestUrl "${requestUrl}".`
        code = C.ErrorCodes.OperationNotFoundInCacheWithApi
        log.debug(msg)
      }
    } else {
      // provider does not exist in cache
      msg = `Could not find provider "${provider}" in the cache.`
      code = C.ErrorCodes.OperationNotFoundInCacheWithProvider
      log.debug(`${msg} We'll search in the resource provider "Microsoft.Unknown".`)
      potentialOperations = this.getPotentialOperationsHelper(pathStr, requestMethod, [])
    }

    // Provide reason when we do not find any potential operation in cache
    if (potentialOperations.length === 0) {
      liveValidationError = new models.LiveValidationError(code.name, msg)
    }

    return new models.PotentialOperationsResult(
      potentialOperations,
      provider,
      apiVersion,
      liveValidationError
    )
  }

  /**
   *  Validates live request.
   */
  public validateLiveRequest(
    liveRequest: LiveRequest,
    options: ValidateOptions = {}
  ): LiveValidationResult {
    let operation
    try {
      operation = this.findSpecOperation(liveRequest.url, liveRequest.method)
    } catch (err) {
      return {
        isSuccessful: undefined,
        errors: [],
        runtimeException: err,
        operationInfo: { apiVersion: C.unknownApiVersion, operationId: C.unknownOperationId }
      }
    }
    if (!liveRequest.query) {
      liveRequest.query = url.parse(liveRequest.url, true).query
    }
    let errors: LiveValidationIssue[] = []
    let runtimeException
    try {
      const reqResult = operation.validateRequest(liveRequest, options)
      const processedErrors = processValidationErrors({ errors: [...reqResult.errors] })
      errors = processedErrors
        ? processedErrors
            .map(err => this.toLiveValidationIssue(err as any))
            .filter(
              err =>
                !options.includeErrors ||
                options.includeErrors.length === 0 ||
                options.includeErrors.includes(err.code)
            )
        : []
    } catch (reqValidationError) {
      const msg =
        `An error occurred while validating the live request for operation ` +
        `"${operation.operationId}". The error is:\n ` +
        `${util.inspect(reqValidationError, { depth: null })}`
      runtimeException = { code: C.ErrorCodes.RequestValidationError.name, message: msg }
    }
    return {
      isSuccessful: runtimeException ? undefined : errors.length === 0,
      operationInfo: {
        apiVersion: operation.apiVersion,
        operationId: operation.operationId
      },
      errors,
      runtimeException
    }
  }
  private toLiveValidationIssue(err: { [index: string]: any; url: string }): LiveValidationIssue {
    return {
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "",
      pathsInPayload: err.path ? [err.path, ...(err.similarPaths || [])] : [],
      jsonPathsInPayload: err.jsonPath ? [err.jsonPath, ...(err.similarJsonPaths || [])] : [],
      schemaPath: err.schemaPath || "",
      inner: Array.isArray(err.inner)
        ? err.inner.map(innerErr => this.toLiveValidationIssue(innerErr))
        : undefined,
      severity: errorCodeToErrorMetadata(err.code).severity,
      params: err.params || undefined,
      source: {
        url:
          this.options.useRelativeSourceLocationUrl && err.url
            ? err.url.substr(this.options.directory.length)
            : err.url,
        jsonRef: err.title || "",
        position: {
          column: err.position ? err.position.column : -1,
          line: err.position ? err.position.line : -1
        }
      },
      documentationUrl: errorCodeToErrorMetadata(err.code).docUrl
    }
  }

  /**
   * Validates live response.
   */
  public validateLiveResponse(
    liveResponse: LiveResponse,
    specOperation: ApiOperationIdentifier,
    options: ValidateOptions = {}
  ): LiveValidationResult {
    let operation: OperationWithApiVersion
    try {
      operation = this.findSpecOperation(specOperation.url, specOperation.method)
    } catch (err) {
      return {
        isSuccessful: undefined,
        errors: [],
        runtimeException: err,
        operationInfo: { apiVersion: C.unknownApiVersion, operationId: C.unknownOperationId }
      }
    }
    let errors: LiveValidationIssue[] = []
    let runtimeException
    // If status code is passed as a status code string (e.g. "OK") transform it to the status code
    // number (e.g. '200').
    if (
      !http.STATUS_CODES[liveResponse.statusCode] &&
      utils.statusCodeStringToStatusCode[liveResponse.statusCode.toLowerCase()]
    ) {
      liveResponse.statusCode =
        utils.statusCodeStringToStatusCode[liveResponse.statusCode.toLowerCase()]
    }
    try {
      const resResult = operation.validateResponse(liveResponse, options)
      const processedErrors = processValidationErrors({ errors: [...resResult.errors] })
      errors = processedErrors
        ? processedErrors
            .map(err => this.toLiveValidationIssue(err as any))
            .filter(
              err =>
                !options.includeErrors ||
                options.includeErrors.length === 0 ||
                options.includeErrors.includes(err.code)
            )
        : []
    } catch (resValidationError) {
      const msg =
        `An error occurred while validating the live response for operation ` +
        `"${operation.operationId}". The error is:\n ` +
        `${util.inspect(resValidationError, { depth: null })}`
      runtimeException = { code: C.ErrorCodes.RequestValidationError.name, message: msg }
    }

    return {
      isSuccessful: runtimeException ? undefined : errors.length === 0,
      operationInfo: {
        apiVersion: operation.apiVersion,
        operationId: operation.operationId
      },
      errors,
      runtimeException
    }
  }

  /**
   * Validates live request and response.
   */
  public validateLiveRequestResponse(
    requestResponseObj: RequestResponsePair,
    options?: ValidateOptions
  ): RequestResponseLiveValidationResult {
    const validationResult = {
      requestValidationResult: {
        errors: [],
        operationInfo: { apiVersion: C.unknownApiVersion, operationId: C.unknownOperationId }
      },
      responseValidationResult: {
        errors: [],
        operationInfo: { apiVersion: C.unknownApiVersion, operationId: C.unknownOperationId }
      }
    }
    if (!requestResponseObj) {
      const message = 'requestResponseObj cannot be null or undefined and must be of type "object".'
      return {
        ...validationResult,
        runtimeException: {
          code: C.ErrorCodes.IncorrectInput.name,
          message
        }
      }
    }
    try {
      // We are using this to validate the payload as per the definitions in swagger.
      // We do not need the serialized output from ms-rest.
      const mapper = new models.RequestResponse().mapper()
        // tslint:disable-next-line:align whitespace
      ;(msRest as any).models = models
      // tslint:disable-next-line:align whitespace
      ;(msRest as any).serialize(mapper, requestResponseObj, "requestResponseObj")
    } catch (err) {
      const message =
        `Found errors "${err.message}" in the provided input:\n` +
        `${util.inspect(requestResponseObj, { depth: null })}.`
      return {
        ...validationResult,
        runtimeException: {
          message,
          code: C.ErrorCodes.IncorrectInput.name
        }
      }
    }
    const request = requestResponseObj.liveRequest
    const response = requestResponseObj.liveResponse

    const requestValidationResult = this.validateLiveRequest(request, options)
    const responseValidationResult = this.validateLiveResponse(
      response,
      {
        method: request.method,
        url: request.url
      },
      options
    )

    return {
      requestValidationResult,
      responseValidationResult
    }
  }

  /**
   * Gets list of potential operations objects for given path and method.
   *
   * @param {string} requestPath The path of the url for which to find potential operations.
   *
   * @param {string} requestMethod The http verb for the method to be used for lookup.
   *
   * @param {Array<Operation>} operations The list of operations to search.
   *
   * @returns {Array<Operation>} List of potential operations matching the requestPath.
   */
  private getPotentialOperationsHelper(
    requestPath: string,
    requestMethod: string,
    operations: Operation[]
  ): Operation[] {
    if (
      requestPath === null ||
      requestPath === undefined ||
      typeof requestPath.valueOf() !== "string" ||
      !requestPath.trim().length
    ) {
      throw new Error(
        'requestPath is a required parameter of type "string" and it cannot be an empty string.'
      )
    }

    if (
      requestMethod === null ||
      requestMethod === undefined ||
      typeof requestMethod.valueOf() !== "string" ||
      !requestMethod.trim().length
    ) {
      throw new Error(
        'requestMethod is a required parameter of type "string" and it cannot be an empty string.'
      )
    }

    if (operations === null || operations === undefined || !Array.isArray(operations)) {
      throw new Error('operations is a required parameter of type "array".')
    }

    const requestUrl = formatUrlToExpectedFormat(requestPath)
    let potentialOperations = operations.filter(operation => {
      const pathObject = operation.pathObject
      const pathMatch = pathObject.regexp.exec(requestUrl)
      return pathMatch !== null
    })

    // If we do not find any match then we'll look into Microsoft.Unknown -> unknown-api-version
    // for given requestMethod as the fall back option
    if (!potentialOperations.length) {
      const c = this.cache[C.unknownResourceProvider]
      if (c && c[C.unknownApiVersion]) {
        operations = c[C.unknownApiVersion][requestMethod]
        potentialOperations = operations.filter(operation => {
          const pathObject = operation.pathObject
          let pathTemplate = pathObject.path
          if (pathTemplate && pathTemplate.includes("?")) {
            pathTemplate = pathTemplate.slice(0, pathTemplate.indexOf("?"))
            pathObject.path = pathTemplate
          }
          const pathMatch = pathObject.regexp.exec(requestPath)
          return pathMatch !== null
        })
      }
    }

    return potentialOperations
  }

  /**
   * Gets the swagger operation based on the HTTP url and method
   */
  private findSpecOperation(requestUrl: string, requestMethod: string): OperationWithApiVersion {
    let potentialOperationsResult
    try {
      potentialOperationsResult = this.getPotentialOperations(requestUrl, requestMethod)
    } catch (err) {
      const msg =
        `An error occurred while trying to search for potential operations:\n` +
        `${util.inspect(err, { depth: null })}`
      const e = new models.LiveValidationError(C.ErrorCodes.PotentialOperationSearchError.name, msg)
      throw e
    }

    // Found empty potentialOperations
    if (potentialOperationsResult.operations.length === 0) {
      throw potentialOperationsResult.reason
      // Found more than 1 potentialOperations
    } else if (potentialOperationsResult.operations.length > 1) {
      const operationIds = potentialOperationsResult.operations
        .map(operation => operation.operationId)
        .join()
      const msg =
        `Found multiple matching operations with operationIds "${operationIds}" ` +
        `for request url "${url}" with HTTP Method "${requestMethod}".`
      log.debug(msg)
      const e = new models.LiveValidationError(C.ErrorCodes.MultipleOperationsFound.name, msg)
      throw e
    }

    const op = potentialOperationsResult.operations[0]
    Object.assign(op, { apiVersion: potentialOperationsResult.apiVersion })
    return op as OperationWithApiVersion
  }

  private async getSwaggerPaths(): Promise<string[]> {
    if (this.options.swaggerPaths.length !== 0) {
      log.debug(
        `Using user provided swagger paths. Total paths: ${this.options.swaggerPaths.length}`
      )
      return this.options.swaggerPaths
    } else {
      const allJsonsPattern = "/specification/**/*.json"
      const jsonsPattern = path.join(
        this.options.directory,
        this.options.swaggerPathsPattern || allJsonsPattern
      )
      const swaggerPaths = await globby(jsonsPattern, {
        ignore: [
          "**/examples/**/*",
          "**/quickstart-templates/**/*",
          "**/schema/**/*",
          "**/live/**/*",
          "**/wire-format/**/*"
        ],
        onlyFiles: true,
        unique: true
      })
      log.debug(
        `Using swaggers found from directory: "${this.options.directory}" and pattern: "${jsonsPattern}".
        Total paths: ${swaggerPaths.length}`
      )
      return swaggerPaths
    }
  }

  private async getSwaggerInitializer(swaggerPath: string): Promise<void> {
    log.info(`Building cache from: "${swaggerPath}"`)

    const validator = new SpecValidator(swaggerPath, null, {
      isPathCaseSensitive: this.options.isPathCaseSensitive,
      shouldResolveXmsExamples: false
    })

    try {
      const api = await validator.initialize()

      const operations = api.getOperations()
      let apiVersion = api.info.version.toLowerCase()

      for (const operation of operations) {
        const httpMethod = operation.method.toLowerCase()
        const pathObject = operation.pathObject
        const pathStr = pathObject.path
        let provider = utils.getProvider(pathStr)
        log.debug(`${apiVersion}, ${operation.operationId}, ${pathStr}, ${httpMethod}`)

        if (!provider) {
          const title = api.info.title

          // Whitelist lookups: Look up knownTitleToResourceProviders
          // Putting the provider namespace onto operation for future use
          if (title && C.knownTitleToResourceProviders[title]) {
            operation.provider = C.knownTitleToResourceProviders[title]
          }

          // Put the operation into 'Microsoft.Unknown' RPs
          provider = C.unknownResourceProvider
          apiVersion = C.unknownApiVersion
          log.debug(
            `Unable to find provider for path : "${pathObject.path}". ` +
              `Bucketizing into provider: "${provider}"`
          )
        }
        provider = provider.toLowerCase()

        // Get all api-version for given provider or initialize it
        const apiVersions = this.cache[provider] || {}
        // Get methods for given apiVersion or initialize it
        const allMethods = apiVersions[apiVersion] || {}
        // Get specific http methods array for given verb or initialize it
        const operationsForHttpMethod = allMethods[httpMethod] || []

        // Builds the cache
        operationsForHttpMethod.push(operation)
        allMethods[httpMethod] = operationsForHttpMethod
        apiVersions[apiVersion] = allMethods
        this.cache[provider] = apiVersions
      }
    } catch (err) {
      // Do Not reject promise in case, we cannot initialize one of the swagger
      log.debug(`Unable to initialize "${swaggerPath}" file from SpecValidator. Error: ${err}`)
      log.warn(
        `Unable to initialize "${swaggerPath}" file from SpecValidator. We are ` +
          `ignoring this swagger file and continuing to build cache for other valid specs.`
      )
    }
  }
}

/**
 * OAV expects the url that is sent to match exactly with the swagger path. For this we need to keep only the part after
 * where the swagger path starts. Currently those are '/subscriptions' and '/providers'.
 */
export function formatUrlToExpectedFormat(requestUrl: string): string {
  return requestUrl.substring(requestUrl.search("/?(subscriptions|providers)"))
}
