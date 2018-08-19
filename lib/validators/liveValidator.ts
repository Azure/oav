// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as util from "util"
import * as path from "path"
import * as os from "os"
import * as url from "url"
import * as _ from "lodash"
import * as glob from "glob"
import * as msRest from "ms-rest"
import { SpecValidator } from "./specValidator"
import * as C from "../util/constants"
import { log } from "../util/logging"
import * as utils from "../util/utils"
import * as models from "../models"
import * as http from "http"
import { PotentialOperationsResult } from "../models/potentialOperationsResult"
import { Operation, Path, Request } from "yasway"
import { ParsedUrlQuery } from "querystring"
import { MutableStringMap } from "@ts-common/string-map"

export interface Options {
  swaggerPaths: string[]
  git: {
    url: string
    shouldClone: boolean
    branch?: string
  }
  directory: string
  swaggerPathsPattern?: string
  shouldModelImplicitDefaultResponse?: boolean
  isPathCaseSensitive?: boolean
}

export interface ApiVersion {
  [method: string]: Operation[]
}

export interface Provider {
  [apiVersion: string]: ApiVersion
}

export interface RequestResponseObj {
  readonly liveRequest: Request
  readonly liveResponse: {
    statusCode: string
  }
}

export interface RequestValidationResult {
  successfulRequest: unknown
  operationInfo?: unknown
  errors?: Array<unknown>
}

export interface ResponseValidationResult {
  successfulResponse: unknown
  operationInfo?: unknown
  errors?: Array<unknown>
}

export interface ValidationResult {
  readonly requestValidationResult: RequestValidationResult
  readonly responseValidationResult: ResponseValidationResult
  errors: Array<unknown>
}

/**
 * @class
 * Live Validator for Azure swagger APIs.
 */
export class LiveValidator {
  public readonly cache: MutableStringMap<Provider> = {}

  public options: Options

  /**
   * Constructs LiveValidator based on provided options.
   *
   * @param {object} optionsRaw The configuration options.
   *
   * @param {array} [options.swaggerPaths] Array of swagger paths to be used for initializing Live
   *    Validator. This has precedence over {@link options.swaggerPathsPattern}.
   *
   * @param {string} [options.swaggerPathsPattern] Pattern for swagger paths to be used for
   *    initializing Live Validator.
   *
   * @param {string} [options.isPathCaseSensitive] Specifies if the swagger path is to be considered
   *    case sensitive.
   *
   * @param {string} [options.git.url] The url of the github repository. Defaults to
   *    "https://github.com/Azure/azure-rest-api-specs.git".
   *
   * @param {string} [options.git.shouldClone] Specifies whether to clone the repository or not.
   *    Defaults to false.
   *
   * @param {string} [options.git.branch] The branch  of the github repository to use instead of the
   *    default branch.
   *
   * @param {string} [options.directory] The directory where to clone github repository or from
   *    where to find swaggers. Defaults to "repo" under user directory.
   *
   * @param {string} [options.shouldModelImplicitDefaultResponse] Specifies if to model a default
   *    response for operations even if it is not specified in the specs.
   *
   * @returns {object} CacheBuilder Returns the configured CacheBuilder object.
   */
  constructor(optionsRaw?: any) {
    optionsRaw =
      optionsRaw === null || optionsRaw === undefined ? {} : optionsRaw

    if (typeof optionsRaw !== "object") {
      throw new Error('options must be of type "object".')
    }
    if (
      optionsRaw.swaggerPaths === null ||
      optionsRaw.swaggerPaths === undefined
    ) {
      optionsRaw.swaggerPaths = []
    }
    if (!Array.isArray(optionsRaw.swaggerPaths)) {
      const paths = typeof optionsRaw.swaggerPaths
      throw new Error(
        `options.swaggerPaths must be of type "array" instead of type "${paths}".`
      )
    }
    if (optionsRaw.git === null || optionsRaw.git === undefined) {
      optionsRaw.git = {
        url: "https://github.com/Azure/azure-rest-api-specs.git",
        shouldClone: false
      }
    }
    if (typeof optionsRaw.git !== "object") {
      throw new Error('options.git must be of type "object".')
    }
    if (optionsRaw.git.url === null || optionsRaw.git.url === undefined) {
      optionsRaw.git.url = "https://github.com/Azure/azure-rest-api-specs.git"
    }
    if (typeof optionsRaw.git.url.valueOf() !== "string") {
      throw new Error('options.git.url must be of type "string".')
    }
    if (
      optionsRaw.git.shouldClone === null ||
      optionsRaw.git.shouldClone === undefined
    ) {
      optionsRaw.git.shouldClone = false
    }
    if (typeof optionsRaw.git.shouldClone !== "boolean") {
      throw new Error('options.git.shouldClone must be of type "boolean".')
    }
    if (optionsRaw.directory === null || optionsRaw.directory === undefined) {
      optionsRaw.directory = path.resolve(os.homedir(), "repo")
    }
    if (typeof optionsRaw.directory.valueOf() !== "string") {
      throw new Error('options.directory must be of type "string".')
    }
    this.options = optionsRaw
  }

  /**
   * Initializes the Live Validator.
   */
  public async initialize(): Promise<void> {
    // Clone github repository if required
    if (this.options.git.shouldClone) {
      utils.gitClone(
        this.options.directory,
        this.options.git.url,
        this.options.git.branch
      )
    }

    // Construct array of swagger paths to be used for building a cache
    const swaggerPaths = this.getSwaggerPaths()

    // console.log(swaggerPaths);
    // Create array of promise factories that builds up cache
    // Structure of the cache is
    // {
    //   "provider1": {
    //     "api-version1": {
    //       "get": [
    //         "operation1",
    //         "operation2",
    //       ],
    //       "put": [
    //         "operation1",
    //         "operation2",
    //       ],
    //       ...
    //     },
    //     ...
    //   },
    //   "microsoft.unknown": {
    //     "unknown-api-version": {
    //      "post": [
    //        "operation1"
    //      ]
    //    }
    //   }
    //   ...
    // }
    const promiseFactories = swaggerPaths.map(swaggerPath => async () =>
      await this.getSwaggerInitializer(swaggerPath)
    )

    await utils.executePromisesSequentially(promiseFactories)
    log.info("Cache initialization complete.")
  }

  /**
   * Gets list of potential operations objects for given url and method.
   *
   * @param {string} requestUrl The url for which to find potential operations.
   *
   * @param {string} requestMethod The http verb for the method to be used for lookup.
   *
   * @returns {PotentialOperationsResult} Potential operation result object.
   */
  public getPotentialOperations(
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
    let result
    let msg
    let code
    let liveValidationError: models.LiveValidationError | undefined
    if (pathStr === null || pathStr === undefined) {
      msg = `Could not find path from requestUrl: "${requestUrl}".`
      liveValidationError = new models.LiveValidationError(
        C.ErrorCodes.PathNotFoundInRequestUrl.name,
        msg
      )
      result = new models.PotentialOperationsResult(
        potentialOperations,
        liveValidationError
      )
      return result
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
          log.debug(
            `${msg} We'll search in the resource provider "Microsoft.Unknown".`
          )
          potentialOperations = this.getPotentialOperationsHelper(
            pathStr,
            requestMethod,
            []
          )
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
      log.debug(
        `${msg} We'll search in the resource provider "Microsoft.Unknown".`
      )
      potentialOperations = this.getPotentialOperationsHelper(
        pathStr,
        requestMethod,
        []
      )
    }

    // Provide reason when we do not find any potential operation in cache
    if (potentialOperations.length === 0) {
      liveValidationError = new models.LiveValidationError(code.name, msg)
    }

    result = new models.PotentialOperationsResult(
      potentialOperations,
      liveValidationError
    )
    return result
  }

  /**
   * Validates live request and response.
   *
   * @param {object} requestResponseObj - The wrapper that contains the live request and response
   * @param {object} requestResponseObj.liveRequest - The live request
   * @param {object} requestResponseObj.liveResponse - The live response
   * @returns {object} validationResult - Validation result for given input
   */
  public validateLiveRequestResponse(
    requestResponseObj: RequestResponseObj
  ): ValidationResult {
    const validationResult: ValidationResult = {
      requestValidationResult: {
        successfulRequest: false
      },
      responseValidationResult: {
        successfulResponse: false
      },
      errors: []
    }
    if (
      !requestResponseObj ||
      (requestResponseObj && typeof requestResponseObj !== "object")
    ) {
      const msg =
        'requestResponseObj cannot be null or undefined and must be of type "object".'
      const e = new models.LiveValidationError(
        C.ErrorCodes.IncorrectInput.name,
        msg
      )
      validationResult.errors.push(e)
      return validationResult
    }
    try {
      // We are using this to validate the payload as per the definitions in swagger.
      // We do not need the serialized output from ms-rest.
      const mapper = new models.RequestResponse().mapper()
      // tslint:disable-next-line:align whitespace
      ;(msRest as any).models = models
      // tslint:disable-next-line:align whitespace
      ;(msRest as any).serialize(
        mapper,
        requestResponseObj,
        "requestResponseObj"
      )
    } catch (err) {
      const msg =
        `Found errors "${err.message}" in the provided input:\n` +
        `${util.inspect(requestResponseObj, { depth: null })}.`
      const e = new models.LiveValidationError(
        C.ErrorCodes.IncorrectInput.name,
        msg
      )
      validationResult.errors.push(e)
      return validationResult
    }
    const request = requestResponseObj.liveRequest
    const response = requestResponseObj.liveResponse

    // If status code is passed as a status code string (e.g. "OK") transform it to the status code
    // number (e.g. '200').
    if (
      response &&
      !http.STATUS_CODES[response.statusCode] &&
      utils.statusCodeStringToStatusCode[response.statusCode.toLowerCase()]
    ) {
      response.statusCode =
        utils.statusCodeStringToStatusCode[response.statusCode.toLowerCase()]
    }

    if (!request.query) {
      request.query = url.parse(request.url, true).query
    }
    const currentApiVersion =
      request.query["api-version"] || C.unknownApiVersion
    let potentialOperationsResult
    let potentialOperations: Operation[] = []
    try {
      potentialOperationsResult = this.getPotentialOperations(
        request.url,
        request.method
      )
      potentialOperations = potentialOperationsResult.operations
    } catch (err) {
      const msg =
        `An error occurred while trying to search for potential operations:\n` +
        `${util.inspect(err, { depth: null })}`
      const e = new models.LiveValidationError(
        C.ErrorCodes.PotentialOperationSearchError.name,
        msg
      )
      validationResult.errors.push(e)
      return validationResult
    }

    // Found empty potentialOperations
    if (potentialOperations.length === 0) {
      validationResult.errors.push(potentialOperationsResult.reason)
      return validationResult
      // Found more than 1 potentialOperations
    } else if (potentialOperations.length !== 1) {
      const operationIds = potentialOperations.map(op => op.operationId).join()
      const msg =
        `Found multiple matching operations with operationIds "${operationIds}" ` +
        `for request url "${request.url}" with HTTP Method "${request.method}".`
      log.debug(msg)
      const err = new models.LiveValidationError(
        C.ErrorCodes.MultipleOperationsFound.name,
        msg
      )
      validationResult.errors = [err]
      return validationResult
    }

    const operation = potentialOperations[0]
    const basicOperationInfo = {
      operationId: operation.operationId,
      apiVersion: currentApiVersion
    }
    validationResult.requestValidationResult.operationInfo = [
      basicOperationInfo
    ]
    validationResult.responseValidationResult.operationInfo = [
      basicOperationInfo
    ]
    let reqResult
    try {
      reqResult = operation.validateRequest(request)
      validationResult.requestValidationResult.errors = reqResult.errors || []
      log.debug("Request Validation Result")
      log.debug(reqResult.toString())
    } catch (reqValidationError) {
      const msg =
        `An error occurred while validating the live request for operation ` +
        `"${operation.operationId}". The error is:\n ` +
        `${util.inspect(reqValidationError, { depth: null })}`
      const err = new models.LiveValidationError(
        C.ErrorCodes.RequestValidationError.name,
        msg
      )
      validationResult.requestValidationResult.errors = [err]
    }
    let resResult
    try {
      resResult = operation.validateResponse(response)
      validationResult.responseValidationResult.errors = resResult.errors || []
      log.debug("Response Validation Result")
      log.debug(resResult.toString())
    } catch (resValidationError) {
      const msg =
        `An error occurred while validating the live response for operation ` +
        `"${operation.operationId}". The error is:\n ` +
        `${util.inspect(resValidationError, { depth: null })}`
      const err = new models.LiveValidationError(
        C.ErrorCodes.ResponseValidationError.name,
        msg
      )
      validationResult.responseValidationResult.errors = [err]
    }
    if (
      reqResult &&
      reqResult.errors &&
      Array.isArray(reqResult.errors) &&
      !reqResult.errors.length
    ) {
      validationResult.requestValidationResult.successfulRequest = true
    }
    if (
      resResult &&
      resResult.errors &&
      Array.isArray(resResult.errors) &&
      !resResult.errors.length
    ) {
      validationResult.responseValidationResult.successfulResponse = true
    }

    return validationResult
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

    if (
      operations === null ||
      operations === undefined ||
      !Array.isArray(operations)
    ) {
      throw new Error('operations is a required parameter of type "array".')
    }

    let potentialOperations = operations.filter(operation => {
      const pathObject = operation.pathObject as Path
      const pathMatch = pathObject.regexp.exec(requestPath)
      return pathMatch !== null
    })

    // If we do not find any match then we'll look into Microsoft.Unknown -> unknown-api-version
    // for given requestMethod as the fall back option
    if (!potentialOperations.length) {
      const c = this.cache[C.unknownResourceProvider]
      if (c && c[C.unknownApiVersion]) {
        operations = c[C.unknownApiVersion][requestMethod]
        potentialOperations = operations.filter(operation => {
          const pathObject = operation.pathObject as Path
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

  private getSwaggerPaths(): string[] {
    if (this.options.swaggerPaths.length !== 0) {
      log.debug(
        `Using user provided swagger paths. Total paths: ${
          this.options.swaggerPaths.length
        }`
      )
      return this.options.swaggerPaths
    } else {
      const allJsonsPattern = "/specification/**/*.json"
      const jsonsPattern = path.join(
        this.options.directory,
        this.options.swaggerPathsPattern || allJsonsPattern
      )
      const swaggerPaths = glob.sync(jsonsPattern, {
        ignore: [
          "**/examples/**/*",
          "**/quickstart-templates/**/*",
          "**/schema/**/*",
          "**/live/**/*",
          "**/wire-format/**/*"
        ]
      })
      const dir = this.options.directory
      log.debug(
        `Using swaggers found from directory "${dir}" and pattern "${jsonsPattern}".` +
          `Total paths: ${swaggerPaths.length}`
      )
      return swaggerPaths
    }
  }

  private async getSwaggerInitializer(swaggerPath: string): Promise<void> {
    log.info(`Building cache from: "${swaggerPath}"`)

    const validator = new SpecValidator(swaggerPath, null, {
      shouldModelImplicitDefaultResponse: this.options
        .shouldModelImplicitDefaultResponse,
      isPathCaseSensitive: this.options.isPathCaseSensitive
    })

    try {
      const api = await validator.initialize()

      const operations = api.getOperations()
      let apiVersion = api.info.version.toLowerCase()

      operations.forEach(operation => {
        const httpMethod = operation.method.toLowerCase()
        const pathObject = operation.pathObject as Path
        const pathStr = pathObject.path
        let provider = utils.getProvider(pathStr)
        log.debug(
          `${apiVersion}, ${operation.operationId}, ${pathStr}, ${httpMethod}`
        )

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
      })
    } catch (err) {
      // Do Not reject promise in case, we cannot initialize one of the swagger
      log.debug(
        `Unable to initialize "${swaggerPath}" file from SpecValidator. Error: ${err}`
      )
      log.warn(
        `Unable to initialize "${swaggerPath}" file from SpecValidator. We are ` +
          `ignoring this swagger file and continuing to build cache for other valid specs.`
      )
    }
  }
}
