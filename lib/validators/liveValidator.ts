// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import util = require('util')
import path = require('path')
import os = require('os')
import url = require('url')
import _ = require('lodash')
import glob = require('glob')
import msRest = require('ms-rest')
import SpecValidator = require('./specValidator')
import { Constants } from '../util/constants'
import { log } from '../util/logging'
import * as utils from '../util/utils'
import models = require('../models')
import http = require('http')
import { PotentialOperationsResult } from '../models/potentialOperationsResult'

/**
 * @class
 * Live Validator for Azure swagger APIs.
 */
export class LiveValidator {
  cache: any

  /**
   * Constructs LiveValidator based on provided options.
   *
   * @param {object} options The configuration options.
   *
   * @param {array} [options.swaggerPaths] Array of swagger paths to be used for initializing Live Validator. This has precedence over {@link options.swaggerPathsPattern}.
   *
   * @param {string} [options.swaggerPathsPattern] Pattern for swagger paths to be used for initializing Live Validator.
   *
   * @param {string} [options.isPathCaseSensitive] Specifies if the swagger path is to be considered case sensitive.
   *
   * @param {string} [options.git.url] The url of the github repository. Defaults to "https://github.com/Azure/azure-rest-api-specs.git".
   *
   * @param {string} [options.git.shouldClone] Specifies whether to clone the repository or not. Defaults to false.
   *
   * @param {string} [options.git.branch] The branch  of the github repository to use instead of the default branch.
   *
   * @param {string} [options.directory] The directory where to clone github repository or from where to find swaggers. Defaults to "repo" under user directory.
   *
   * @param {string} [options.shouldModelImplicitDefaultResponse] Specifies if to model a default response for operations even if it is not specified in the specs.
   *
   * @returns {object} CacheBuilder Returns the configured CacheBuilder object.
   */
  constructor(public options?: any) {

    if (this.options === null || this.options === undefined) {
      this.options = {}
    }
    if (typeof this.options !== 'object') {
      throw new Error('options must be of type "object".')
    }
    if (this.options.swaggerPaths === null || this.options.swaggerPaths === undefined) {
      this.options.swaggerPaths = []
    }
    if (!Array.isArray(this.options.swaggerPaths)) {
      throw new Error(
        `options.swaggerPaths must be of type "array" instead of type "${typeof this.options.swaggerPaths}".`)
    }
    if (this.options.git === null || this.options.git === undefined) {
      this.options.git = {
        "url": "https://github.com/Azure/azure-rest-api-specs.git",
        "shouldClone": false
      }
    }
    if (typeof this.options.git !== 'object') {
      throw new Error('options.git must be of type "object".')
    }
    if (this.options.git.url === null || this.options.git.url === undefined) {
      this.options.git.url = "https://github.com/Azure/azure-rest-api-specs.git"
    }
    if (typeof this.options.git.url.valueOf() !== 'string') {
      throw new Error('options.git.url must be of type "string".')
    }
    if (this.options.git.shouldClone === null || this.options.git.shouldClone === undefined) {
      this.options.git.shouldClone = false
    }
    if (typeof this.options.git.shouldClone !== 'boolean') {
      throw new Error('options.git.shouldClone must be of type "boolean".')
    }
    if (this.options.directory === null || this.options.directory === undefined) {
      this.options.directory = path.resolve(os.homedir(), 'repo')
    }
    if (typeof this.options.directory.valueOf() !== 'string') {
      throw new Error('options.directory must be of type "string".')
    }
    this.cache = {}
  }

  /**
   * Initializes the Live Validator.
   */
  initialize() {
    let self = this

    // Clone github repository if required
    if (self.options.git.shouldClone) {
      utils.gitClone(self.options.directory, self.options.git.url, self.options.git.branch)
    }

    // Construct array of swagger paths to be used for building a cache
    let swaggerPaths
    if (self.options.swaggerPaths.length !== 0) {
      swaggerPaths = self.options.swaggerPaths
      log.debug(`Using user provided swagger paths. Total paths: ${swaggerPaths.length}`)
    } else {
      let allJsonsPattern = '/specification/**/*.json'
      let jsonsPattern = path.join(
        self.options.directory, self.options.swaggerPathsPattern || allJsonsPattern)
      swaggerPaths = glob.sync(
        jsonsPattern,
        {
          ignore: [
            '**/examples/**/*', '**/quickstart-templates/**/*', '**/schema/**/*', '**/live/**/*', '**/wire-format/**/*'
          ]
        })
      log.debug(
        `Using swaggers found from directory "${self.options.directory}" and pattern "${jsonsPattern}". Total paths: ${swaggerPaths.length}`)
    }
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
    let promiseFactories = swaggerPaths.map((swaggerPath: any) => {
      return () => {
        log.info(`Building cache from: "${swaggerPath}"`)

        let validator = new SpecValidator(
          swaggerPath,
          null,
          {
            shouldModelImplicitDefaultResponse: this.options.shouldModelImplicitDefaultResponse,
            isPathCaseSensitive: this.options.isPathCaseSensitive
          })

        return validator.initialize().then((api: any) => {
          let operations = api.getOperations()
          let apiVersion = api.info.version.toLowerCase()

          operations.forEach((operation: any) => {
            let httpMethod = operation.method.toLowerCase()
            let provider = utils.getProvider(operation.pathObject.path)
            log.debug(`${apiVersion}, ${operation.operationId}, ${operation.pathObject.path}, ${httpMethod}`)

            if (!provider) {
              let title = api.info.title

              // Whitelist lookups: Look up knownTitleToResourceProviders
              // Putting the provider namespace onto operation for future use
              if (title && (Constants.knownTitleToResourceProviders as any)[title]) {
                operation.provider = (Constants.knownTitleToResourceProviders as any)[title]
              }

              // Put the operation into 'Microsoft.Unknown' RPs
              provider = Constants.unknownResourceProvider
              apiVersion = Constants.unknownApiVersion
              log.debug(
                `Unable to find provider for path : "${operation.pathObject.path}". Bucketizing into provider: "${provider}"`)
            }
            provider = provider.toLowerCase()

            // Get all api-version for given provider or initialize it
            let apiVersions = self.cache[provider] || {}
            // Get methods for given apiVersion or initialize it
            let allMethods = apiVersions[apiVersion] || {}
            // Get specific http methods array for given verb or initialize it
            let operationsForHttpMethod = allMethods[httpMethod] || []

            // Builds the cache
            operationsForHttpMethod.push(operation)
            allMethods[httpMethod] = operationsForHttpMethod
            apiVersions[apiVersion] = allMethods
            self.cache[provider] = apiVersions
          })

          return Promise.resolve(self.cache)
        }).catch(function (err: any) {
          // Do Not reject promise in case, we cannot initialize one of the swagger
          log.debug(`Unable to initialize "${swaggerPath}" file from SpecValidator. Error: ${err}`)
          log.warn(
            `Unable to initialize "${swaggerPath}" file from SpecValidator. We are ignoring this swagger file and continuing to build cache for other valid specs.`)
        })
      }
    })

    return utils.executePromisesSequentially(promiseFactories).then(() => {
      log.info("Cache initialization complete.")
    })
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
  getPotentialOperations(requestUrl: string, requestMethod: string): PotentialOperationsResult {
    if (_.isEmpty(this.cache)) {
      let msg =
        `Please call "liveValidator.initialize()" before calling this method, so that cache is populated.`
      throw new Error(msg)
    }

    if (requestUrl === null
      || requestUrl === undefined
      || typeof requestUrl.valueOf() !== 'string'
      || !requestUrl.trim().length) {
      throw new Error(
        'requestUrl is a required parameter of type "string" and it cannot be an empty string.')
    }

    if (requestMethod === null
      || requestMethod === undefined
      || typeof requestMethod.valueOf() !== 'string'
      || !requestMethod.trim().length) {
      throw new Error(
        'requestMethod is a required parameter of type "string" and it cannot be an empty string.')
    }

    let self = this
    let potentialOperations: any[] = []
    let parsedUrl = url.parse(requestUrl, true)
    let path = parsedUrl.pathname
    requestMethod = requestMethod.toLowerCase()
    let result
    let msg
    let code
    let liveValidationError
    if (path === null || path === undefined) {
      msg = `Could not find path from requestUrl: "${requestUrl}".`
      liveValidationError = new models.LiveValidationError(
        Constants.ErrorCodes.PathNotFoundInRequestUrl.name, msg)
      result = new models.PotentialOperationsResult(potentialOperations, liveValidationError)
      return result
    }

    // Lower all the keys of query parameters before searching for `api-version`
    var queryObject = _.transform(parsedUrl.query, function (result: any, value: any, key: any) {
      result[key.toLowerCase()] = value
    })
    let apiVersion: any = queryObject['api-version']
    let provider = utils.getProvider(path)

    // Provider would be provider found from the path or Microsoft.Unknown
    provider = provider || Constants.unknownResourceProvider
    if (provider === Constants.unknownResourceProvider) {
      apiVersion = Constants.unknownApiVersion
    }
    provider = provider.toLowerCase()

    // Search using provider
    let allApiVersions = self.cache[provider]
    if (allApiVersions) {
      // Search using api-version found in the requestUrl
      if (apiVersion) {
        let allMethods = allApiVersions[apiVersion]
        if (allMethods) {
          let operationsForHttpMethod = allMethods[requestMethod]
          // Search using requestMethod provided by user
          if (operationsForHttpMethod) {
            // Find the best match using regex on path
            potentialOperations = self.getPotentialOperationsHelper(
              path, requestMethod, operationsForHttpMethod)
            // If potentialOperations were to be [] then we need reason
            msg =
              `Could not find best match operation for verb "${requestMethod}" for api-version "${apiVersion}" and provider "${provider}" in the cache.`
            code = Constants.ErrorCodes.OperationNotFoundInCache
          } else {
            msg =
              `Could not find any methods with verb "${requestMethod}" for api-version "${apiVersion}" and provider "${provider}" in the cache.`
            code = Constants.ErrorCodes.OperationNotFoundInCacheWithVerb
            log.debug(msg)
          }
        } else {
          msg = `Could not find exact api-version "${apiVersion}" for provider "${provider}" in the cache.`
          code = Constants.ErrorCodes.OperationNotFoundInCacheWithApi
          log.debug(`${msg} We'll search in the resource provider "Microsoft.Unknown".`)
          potentialOperations = self.getPotentialOperationsHelper(path, requestMethod, [])
        }
      } else {
        msg = `Could not find api-version in requestUrl "${requestUrl}".`
        code = Constants.ErrorCodes.OperationNotFoundInCacheWithApi
        log.debug(msg)
      }
    } else {
      // provider does not exist in cache
      msg = `Could not find provider "${provider}" in the cache.`
      code = Constants.ErrorCodes.OperationNotFoundInCacheWithProvider
      log.debug(`${msg} We'll search in the resource provider "Microsoft.Unknown".`)
      potentialOperations = self.getPotentialOperationsHelper(path, requestMethod, [])
    }

    // Provide reason when we do not find any potential operaion in cache
    if (potentialOperations.length === 0) {
      liveValidationError = new models.LiveValidationError(code.name, msg)
    }

    result = new models.PotentialOperationsResult(potentialOperations, liveValidationError)
    return result
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
  getPotentialOperationsHelper(requestPath: string, requestMethod: string, operations: any[]) {
    if (requestPath === null
      || requestPath === undefined
      || typeof requestPath.valueOf() !== 'string'
      || !requestPath.trim().length) {
      throw new Error(
        'requestPath is a required parameter of type "string" and it cannot be an empty string.')
    }

    if (requestMethod === null
      || requestMethod === undefined
      || typeof requestMethod.valueOf() !== 'string'
      || !requestMethod.trim().length) {
      throw new Error(
        'requestMethod is a required parameter of type "string" and it cannot be an empty string.')
    }

    if (operations === null || operations === undefined || !Array.isArray(operations)) {
      throw new Error('operations is a required parameter of type "array".')
    }

    let self = this
    let potentialOperations = []
    potentialOperations = operations.filter((operation) => {
      let pathMatch = operation.pathObject.regexp.exec(requestPath)
      return pathMatch === null ? false : true
    })

    // If we do not find any match then we'll look into Microsoft.Unknown -> unknown-api-version
    // for given requestMethod as the fall back option
    if (!potentialOperations.length) {
      if (self.cache[Constants.unknownResourceProvider] &&
        self.cache[Constants.unknownResourceProvider][Constants.unknownApiVersion]) {
        operations = self.cache[Constants.unknownResourceProvider][Constants.unknownApiVersion][requestMethod]
        potentialOperations = operations.filter((operation) => {
          let pathTemplate = operation.pathObject.path
          if (pathTemplate && pathTemplate.includes("?")) {
            pathTemplate = pathTemplate.slice(0, pathTemplate.indexOf("?"))
            operation.pathObject.path = pathTemplate
          }
          let pathMatch = operation.pathObject.regexp.exec(requestPath)
          return pathMatch === null ? false : true
        })
      }
    }

    return potentialOperations
  }

  /**
   * Validates live request and response.
   *
   * @param {object} requestResponseObj - The wrapper that constains the live request and response
   * @param {object} requestResponseObj.liveRequest - The live request
   * @param {object} requestResponseObj.liveResponse - The live response
   * @returns {object} validationResult - Validation result for given input
   */
  validateLiveRequestResponse(requestResponseObj: any) {
    let self = this
    let validationResult = {
      requestValidationResult: {
        successfulRequest: false,
        operationInfo: undefined as any,
        errors: undefined as any
      },
      responseValidationResult: {
        successfulResponse: false,
        operationInfo: undefined as any,
        errors: undefined as any
      },
      errors: [] as any[]
    };
    if (!requestResponseObj || (requestResponseObj && typeof requestResponseObj !== 'object')) {
      let msg = 'requestResponseObj cannot be null or undefined and must be of type "object".'
      let e = new models.LiveValidationError(Constants.ErrorCodes.IncorrectInput.name, msg)
      validationResult.errors.push(e)
      return validationResult
    }
    try {
      // We are using this to validate the payload as per the definitions in swagger.
      // We do not need the serialized output from ms-rest.
      let mapper = new models.RequestResponse().mapper();
      (msRest as any).models = models;
      (msRest as any).serialize(mapper, requestResponseObj, 'requestResponseObj');
    } catch (err) {
      let msg =
        `Found errors "${err.message}" in the provided input:\n` +
        `${util.inspect(requestResponseObj, { depth: null })}.`
      let e = new models.LiveValidationError(Constants.ErrorCodes.IncorrectInput.name, msg)
      validationResult.errors.push(e)
      return validationResult
    }
    let request = requestResponseObj.liveRequest
    let response = requestResponseObj.liveResponse

    // If status code is passed as a status code string (e.g. "OK") tranform it to the status code number (e.g. '200').
    if (response
      && !http.STATUS_CODES[response.statusCode]
      && utils.statusCodeStringToStatusCode[response.statusCode.toLowerCase()]) {
      response.statusCode = utils.statusCodeStringToStatusCode[response.statusCode.toLowerCase()]
    }

    if (!request.query) {
      request.query = url.parse(request.url, true).query
    }
    let currentApiVersion = request.query['api-version'] || Constants.unknownApiVersion
    let potentialOperationsResult
    let potentialOperations = []
    try {
      potentialOperationsResult = self.getPotentialOperations(request.url, request.method)
      potentialOperations = potentialOperationsResult.operations
    } catch (err) {
      let msg =
        `An error occured while trying to search for potential operations:\n` +
        `${util.inspect(err, { depth: null })}`
      let e = new models.LiveValidationError(
        Constants.ErrorCodes.PotentialOperationSearchError.name, msg)
      validationResult.errors.push(e)
      return validationResult
    }

    // Found empty potentialOperations
    if (potentialOperations.length === 0) {
      validationResult.errors.push(potentialOperationsResult.reason)
      return validationResult
    }
    // Found exactly 1 potentialOperations
    else if (potentialOperations.length === 1) {
      let operation = potentialOperations[0]
      let basicOperationInfo = {
        operationId: operation.operationId,
        apiVersion: currentApiVersion
      }
      validationResult.requestValidationResult.operationInfo = [basicOperationInfo]
      validationResult.responseValidationResult.operationInfo = [basicOperationInfo]
      let reqResult
      try {
        reqResult = operation.validateRequest(request)
        validationResult.requestValidationResult.errors = reqResult.errors || []
        log.debug('Request Validation Result')
        log.debug(reqResult)
      } catch (reqValidationError) {
        let msg =
          `An error occurred while validating the live request for operation "${operation.operationId}". ` +
          `The error is:\n ${util.inspect(reqValidationError, { depth: null })}`
        let err = new models.LiveValidationError(Constants.ErrorCodes.RequestValidationError.name, msg)
        validationResult.requestValidationResult.errors = [err]
      }
      let resResult
      try {
        resResult = operation.validateResponse(response)
        validationResult.responseValidationResult.errors = resResult.errors || []
        log.debug('Response Validation Result')
        log.debug(resResult)
      } catch (resValidationError) {
        let msg =
          `An error occurred while validating the live response for operation "${operation.operationId}". ` +
          `The error is:\n ${util.inspect(resValidationError, { depth: null })}`
        let err = new models.LiveValidationError(Constants.ErrorCodes.ResponseValidationError.name, msg)
        validationResult.responseValidationResult.errors = [err]
      }
      if (reqResult && reqResult.errors && Array.isArray(reqResult.errors) && !reqResult.errors.length) {
        validationResult.requestValidationResult.successfulRequest = true
      }
      if (resResult && resResult.errors && Array.isArray(resResult.errors) && !resResult.errors.length) {
        validationResult.responseValidationResult.successfulResponse = true
      }
    }
    // Found more than 1 potentialOperations
    else {
      let operationIds = potentialOperations.map((op: any) => { return op.operationId; }).join()
      let msg =
        `Found multiple matching operations with operationIds "${operationIds}" ` +
        `for request url "${request.url}" with HTTP Method "${request.method}".`;
      log.debug(msg)
      let err = new models.LiveValidationError(Constants.ErrorCodes.MultipleOperationsFound.name, msg)
      validationResult.errors = [err]
    }

    return validationResult
  }
}
