// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import util = require('util')
import fs = require('fs')
import path = require('path')
import Sway = require('sway')
import msRest = require('ms-rest')

let HttpRequest = msRest.WebResource

import SpecResolver = require('./specResolver')
import * as utils from '../util/utils'
import { Constants } from '../util/constants'
import { log } from '../util/logging'
import { ResponseWrapper } from '../models/responseWrapper'
import { validateResponse } from '../util/validationResponse'

let ErrorCodes = Constants.ErrorCodes;

/*
 * @class
 * Performs semantic and data validation of the given swagger spec.
 */
class SpecValidator {

  specPath: string

  specDir: any

  specInJson: any

  specResolver: any

  specValidationResult: any

  swaggerApi: any

  options: any

  sampleRequest: any

  sampleResponse: any

  /*
   * @constructor
   * Initializes a new instance of the SpecValidator class.
   *
   * @param {string} specPath the (remote|local) swagger spec path
   *
   * @param {object} [specInJson] the parsed spec in json format
   *
   * @param {object} [options.shouldResolveRelativePaths] Should relative pathes be resolved? Default: true
   *
   * @param {object} [options.shouldResolveXmsExamples] Should x-ms-examples be resolved? Default: true.
   * If options.shouldResolveRelativePaths is false then this option will also be false implicitly and cannot be overridden.
   *
   * @param {object} [options.shouldResolveAllOf] Should allOf references be resolved? Default: true
   *
   * @param {object} [options.shouldResolveDiscriminator] Should discriminator be resolved? Default: true
   *
   * @param {object} [options.shouldSetAdditionalPropertiesFalse] Should additionalProperties be set to false? Default: true
   *
   * @param {object} [options.shouldResolvePureObjects] Should pure objects be resolved? Default: true
   *
   * @param {object} [options.shouldResolveParameterizedHost] Should 'x-ms-parameterized-host' be resolved? Default: true
   *
   * @param {object} [options.shouldResolveNullableTypes] Should we allow null values to match any type? Default: true
   *
   * @param {object} [options.isPathCaseSensitive] Specifies if the paths should be considered case sensitive. Default: true
   *
   * @return {object} An instance of the SpecValidator class.
   */
  constructor(specPath: string, specInJson: any, options: any) {
    if (specPath === null
      || specPath === undefined
      || typeof specPath.valueOf() !== 'string'
      || !specPath.trim().length) {
      throw new Error('specPath is a required parameter of type string and it cannot be an empty string.')
    }
    //If the spec path is a url starting with https://github then let us auto convert it to an https://raw.githubusercontent url.
    if (specPath.startsWith('https://github')) {
      specPath = specPath.replace(
        /^https:\/\/(github.com)(.*)blob\/(.*)/ig, 'https://raw.githubusercontent.com$2$3')
    }
    this.specPath = specPath
    this.specDir = path.dirname(this.specPath)
    this.specInJson = specInJson
    this.specResolver = null
    this.specValidationResult = { validityStatus: true, operations: {} }
    this.swaggerApi = null
    if (!options) options = {}
    if (options.shouldResolveRelativePaths === null || options.shouldResolveRelativePaths === undefined) {
      options.shouldResolveRelativePaths = true
    }

    this.options = options
    this.sampleRequest = {}
    this.sampleResponse = {}
  }

  /*
   * Initializes the spec validator. Resolves the spec on different counts using the SpecResolver and initializes the internal api validator.
   */
  initialize() {
    let self = this
    if (self.options.shouldResolveRelativePaths) {
      utils.clearCache()
    }
    if (typeof (self.specInJson) === "undefined" || self.specInJson === null) {
      return utils.parseJson(self.specPath).then(function (result: any) {
        self.specInJson = result
        self.specResolver = new SpecResolver(self.specPath, self.specInJson, self.options)
        return self.specResolver.resolve()
      }).then(function () {
        let options: any = {}
        options.definition = self.specInJson
        options.jsonRefs = {}
        options.jsonRefs.relativeBase = self.specDir
        options.isPathCaseSensitive = self.options.isPathCaseSensitive
        return Sway.create(options)
      }).then(function (api: any) {
        self.swaggerApi = api
        return Promise.resolve(api)
      }).catch(function (err: any) {
        let e = self.constructErrorObject(ErrorCodes.ResolveSpecError, err.message, [err])
        self.specValidationResult.resolveSpec = e
        log.error(`${ErrorCodes.ResolveSpecError.name}: ${err.message}.`)
        log.error(err.stack)
        return Promise.reject(e)
      })
    } else {
      self.specResolver = new SpecResolver(self.specPath, self.specInJson, self.options)
      return self.specResolver.resolve().then(function () {
        let options: any = {}
        options.definition = self.specInJson
        options.jsonRefs = {}
        options.jsonRefs.relativeBase = self.specDir
        options.isPathCaseSensitive = self.options.isPathCaseSensitive
        return Sway.create(options)
      }).then(function (api: any) {
        self.swaggerApi = api
        return Promise.resolve(api)
      }).catch(function (err: any) {
        let e = self.constructErrorObject(ErrorCodes.ResolveSpecError, err.message, [err])
        self.specValidationResult.resolveSpec = e
        log.error(`${ErrorCodes.ResolveSpecError.name}: ${err.message}.`)
        log.error(err.stack)
        return Promise.reject(e)
      })
    }
  }

  getProviderNamespace() {
    let result = null
    let re = /^(.*)\/providers\/(\w+\.\w+)\/(.*)$/ig
    if (this.specInJson) {
      if (this.specInJson.paths) {
        let paths = utils.getKeys(this.specInJson.paths)
        if (paths) {
          for (let i = 0; i < paths.length; i++) {
            let res = re.exec(paths[i])
            if (res && res[2]) {
              result = res[2]
              break
            }
          }
        }
      }
    }
    return result
  }

  /*
   * Updates the validityStatus of the internal specValidationResult based on the provided value.
   *
   * @param {boolean} value A truthy or a falsy value.
   */
  updateValidityStatus(value?: boolean) {
    if (!Boolean(value)) {
      this.specValidationResult.validityStatus = false
    } else {
      this.specValidationResult.validityStatus = true
    }
    return
  }

  /*
   * Constructs the Error object and updates the validityStatus unless indicated to not update the status.
   *
   * @param {string} code The Error code that uniquely idenitifies the error.
   *
   * @param {string} message The message that provides more information about the error.
   *
   * @param {array} [innerErrors] An array of Error objects that specify inner details.
   *
   * @param {boolean} [skipValidityStatusUpdate] When specified a truthy value it will skip updating the validity status.
   *
   * @return {object} err Return the constructed Error object.
   */
  constructErrorObject(
    code: any, message: string, innerErrors?: null|any[], skipValidityStatusUpdate?: boolean) {

      let err = {
      code: code.name,
      id: code.id,
      message: message,
      innerErrors: undefined as any
    }
    if (innerErrors) {
      err.innerErrors = innerErrors
    }
    if (!skipValidityStatusUpdate) {
      this.updateValidityStatus()
    }
    return err
  }

  validateSpec() {
    let self = this
    self.specValidationResult.validateSpec = {}
    self.specValidationResult.validateSpec.isValid = true
    self.specValidationResult.validateSpec.errors = []
    self.specValidationResult.validateSpec.warnings = []
    if (!self.swaggerApi) {
      let msg =
        `Please call "specValidator.initialize()" before calling this method, so that swaggerApi is populated.`
      let e = self.constructErrorObject(ErrorCodes.InitializationError, msg)
      self.specValidationResult.initialize = e
      self.specValidationResult.validateSpec.isValid = false
      log.error(`${ErrorCodes.InitializationError.name}: ${msg}`)
      return Promise.reject(e)
    }
    try {
      let validationResult = self.swaggerApi.validate()
      if (validationResult) {
        if (validationResult.errors && validationResult.errors.length) {
          self.specValidationResult.validateSpec.isValid = false
          let e = self.constructErrorObject(
            ErrorCodes.SemanticValidationError,
            `The spec ${self.specPath} has semantic validation errors.`,
            validationResult.errors)
          self.specValidationResult.validateSpec.errors = validateResponse.constructErrors(
            e, self.specPath, self.getProviderNamespace())
          log.error(Constants.Errors)
          log.error('------')
          self.updateValidityStatus()
          log.error(e as any)
        } else {
          self.specValidationResult.validateSpec.result = `The spec ${self.specPath} is semantically valid.`
        }
        if (validationResult.warnings && validationResult.warnings.length > 0) {
          let warnings = validateResponse.sanitizeWarnings(validationResult.warnings)
          if (warnings && warnings.length) {
            self.specValidationResult.validateSpec.warnings = warnings
            log.debug(Constants.Warnings)
            log.debug('--------')
            log.debug(util.inspect(warnings))
          }
        }
      }
      return Promise.resolve(validationResult)
    } catch (err) {
      let msg = `An Internal Error occurred in validating the spec "${self.specPath}". \t${err.message}.`
      err.code = ErrorCodes.InternalError.name
      err.id = ErrorCodes.InternalError.id
      err.message = msg
      self.specValidationResult.validateSpec.isValid = false
      self.specValidationResult.validateSpec.error = err
      log.error(err)
      self.updateValidityStatus()
      return Promise.reject(err)
    }
  }

  /*
   * Gets the operation object by operationId specified in the swagger spec.
   *
   * @param {string} id - The operation id.
   *
   * @return {object} operation - The operation object.
   */
  getOperationById(id: string) {
    let self = this
    if (!self.swaggerApi) {
      throw new Error(
        `Please call specValidator.initialize() so that swaggerApi is populated, before calling this method.`)
    }
    if (!id) {
      throw new Error(`id cannot be null or undefined and must be of type string.`)
    }
    let result = this.swaggerApi.getOperations().find(function (item: any) {
      return (item.operationId === id)
    })
    return result
  }

  /*
   * Gets the x-ms-examples object for an operation if specified in the swagger spec.
   *
   * @param {string|object} idOrObj - The operation id or the operation object.
   *
   * @return {object} xmsExample - The xmsExample object.
   */
  getXmsExamples(idOrObj: any) {
    if (!idOrObj) {
      throw new Error(`idOrObj cannot be null or undefined and must be of type string or object.`)
    }
    let operation: any = {}
    if (typeof idOrObj.valueOf() === 'string') {
      operation = this.getOperationById(idOrObj)
    } else {
      operation = idOrObj
    }
    let result
    if (operation && operation[Constants.xmsExamples]) {
      result = operation[Constants.xmsExamples]
    }
    return result
  }

  initializeExampleResult(operationId: any, exampleType: any, scenarioName: any) {
    let initialResult = {
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
    if (exampleType === Constants.exampleInSpec) {
      if (!operationResult[exampleType] ||
        (operationResult[exampleType] && !utils.getKeys(operationResult[exampleType]).length)) {
        operationResult[exampleType] = initialResult
      }
    }

    if (exampleType === Constants.xmsExamples) {
      if (!operationResult[exampleType].scenarios) {
        operationResult[exampleType].scenarios = {}
      }
      if (!operationResult[exampleType].scenarios[scenarioName]) {
        operationResult[exampleType].scenarios[scenarioName] = initialResult
      }
    }
    this.specValidationResult.operations[operationId] = operationResult
    return
  }

  constructRequestResult(
    operationResult: any,
    isValid: any,
    msg: any,
    requestValidationErrors?: any,
    requestValidationWarnings?: any) {

    if (!isValid) {
      operationResult.isValid = false
      operationResult.request.isValid = false
      let e = this.constructErrorObject(ErrorCodes.RequestValidationError, msg, requestValidationErrors)
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
    return
  }

  constructResponseResult(
    operationResult: any,
    responseStatusCode: any,
    isValid: any,
    msg: any,
    responseValidationErrors?: any,
    responseValidationWarnings?: any) {

    if (!operationResult.responses[responseStatusCode]) {
      operationResult.responses[responseStatusCode] = {}
    }
    if (!isValid) {
      operationResult.isValid = false
      operationResult.responses[responseStatusCode].isValid = false
      let e = this.constructErrorObject(ErrorCodes.ResponseValidationError, msg, responseValidationErrors)
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
    return
  }

  constructRequestResultWrapper(
    operationId: any,
    requestValidationErrors: any,
    requestValidationWarnings: any,
    exampleType: any,
    scenarioName?: any) {

    this.initializeExampleResult(operationId, exampleType, scenarioName)
    let operationResult, part, subMsg, infoMsg, errorMsg, warnMsg
    if (exampleType === Constants.xmsExamples) {
      operationResult =
        this.specValidationResult.operations[operationId][exampleType].scenarios[scenarioName]
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
    return
  }

  constructResponseResultWrapper(
    operationId: any,
    responseStatusCode: any,
    responseValidationErrors: any,
    responseValidationWarnings: any,
    exampleType: any,
    scenarioName?: any) {

    this.initializeExampleResult(operationId, exampleType, scenarioName)
    let operationResult, part, subMsg, infoMsg, errorMsg, warnMsg
    if (exampleType === Constants.xmsExamples) {
      operationResult =
        this.specValidationResult.operations[operationId][exampleType].scenarios[scenarioName]
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
    return
  }

  /*
   * Cosntructs the validation result for an operation.
   *
   * @param {object} operation - The operation object.
   *
   * @param {object} result - The validation result that needs to be added to the uber
   * validationResult object for the entire spec.
   *
   * @param {string} exampleType A string specifying the type of example. "x-ms-example", "example-in-spec".
   *
   * @return {object} xmsExample - The xmsExample object.
   */
  constructOperationResult(operation: any, result: any, exampleType: string) {
    let operationId = operation.operationId
    if (result.exampleNotFound) {
      this.specValidationResult.operations[operationId][exampleType].error = result.exampleNotFound
      //log.error(result.exampleNotFound)
    }
    if (exampleType === Constants.xmsExamples) {
      if (result.scenarios) {
        for (let scenario of utils.getKeys(result.scenarios)) {
          //requestValidation
          let requestValidationErrors =
            result.scenarios[scenario].requestValidation.validationResult.errors
          let requestValidationWarnings =
            result.scenarios[scenario].requestValidation.validationResult.warnings
          this.constructRequestResultWrapper(
            operationId, requestValidationErrors, requestValidationWarnings, exampleType, scenario)
          //responseValidation
          for (let responseStatusCode of utils.getKeys(result.scenarios[scenario].responseValidation)) {
            let responseValidationErrors =
              result.scenarios[scenario].responseValidation[responseStatusCode].errors
            let responseValidationWarnings =
              result.scenarios[scenario].responseValidation[responseStatusCode].warnings
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
    } else if (exampleType === Constants.exampleInSpec) {
      if (result.requestValidation && utils.getKeys(result.requestValidation).length) {
        //requestValidation
        let requestValidationErrors = result.requestValidation.validationResult.errors
        let requestValidationWarnings = result.requestValidation.validationResult.warnings
        this.constructRequestResultWrapper(
          operationId, requestValidationErrors, requestValidationWarnings, exampleType)
      }
      if (result.responseValidation && utils.getKeys(result.responseValidation).length) {
        //responseValidation
        for (let responseStatusCode of utils.getKeys(result.responseValidation)) {
          let responseValidationErrors = result.responseValidation[responseStatusCode].errors
          let responseValidationWarnings = result.responseValidation[responseStatusCode].warnings
          this.constructResponseResultWrapper(
            operationId,
            responseStatusCode,
            responseValidationErrors,
            responseValidationWarnings,
            exampleType)
        }
      }
    }
    return
  }

  /*
   * Validates the given operation.
   *
   * @param {object} operation - The operation object.
   */
  validateOperation(operation: any) {
    let self = this
    self.validateXmsExamples(operation)
    self.validateExample(operation)
  }

  /*
   * Validates the given operationIds or all the operations in the spec.
   *
   * @param {string} [operationIds] - A comma sparated string specifying the operations to be validated.
   * If not specified then the entire spec is validated.
   */
  validateOperations(operationIds?: string) {
    let self = this
    if (!self.swaggerApi) {
      throw new Error(
        `Please call "specValidator.initialize()" before calling this method, so that swaggerApi is populated.`)
    }
    if (operationIds !== null
      && operationIds !== undefined
      && typeof operationIds.valueOf() !== 'string') {
      throw new Error(`operationIds parameter must be of type 'string'.`)
    }

    let operations = self.swaggerApi.getOperations()
    if (operationIds) {
      let operationIdsObj: any = {}
      operationIds.trim().split(',').map(function (item) { operationIdsObj[item.trim()] = 1; })
      let operationsToValidate = operations.filter(function (item: any) {
        return Boolean(operationIdsObj[item.operationId])
      })
      if (operationsToValidate.length) operations = operationsToValidate
    }

    for (let i = 0; i < operations.length; i++) {
      let operation = operations[i]
      self.specValidationResult.operations[operation.operationId] = {}
      self.specValidationResult.operations[operation.operationId][Constants.xmsExamples] = {}
      self.specValidationResult.operations[operation.operationId][Constants.exampleInSpec] = {}
      self.validateOperation(operation)
      if (utils
          .getKeys(self.specValidationResult.operations[operation.operationId][Constants.exampleInSpec])
          .length
        === 0) {
        delete self.specValidationResult.operations[operation.operationId][Constants.exampleInSpec]
      }
    }
  }

  /*
   * Validates the x-ms-examples object for an operation if specified in the swagger spec.
   *
   * @param {object} operation - The operation object.
   */
  validateXmsExamples(operation: any) {
    let self = this
    if (operation === null || operation === undefined || typeof operation !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.')
    }
    let xmsExamples = operation[Constants.xmsExamples]
    let result = {
      scenarios: {} as any,
      exampleNotFound: undefined as any
    }
    let resultScenarios = result.scenarios
    if (xmsExamples) {
      for (let scenario of Object.keys(xmsExamples)) {
        let xmsExample = xmsExamples[scenario]
        resultScenarios[scenario] = {}
        resultScenarios[scenario].requestValidation =
          self.validateRequest(operation, xmsExample.parameters)
        resultScenarios[scenario].responseValidation =
          self.validateXmsExampleResponses(operation, xmsExample.responses)
      }
    } else {
      let msg = `x-ms-example not found in ${operation.operationId}.`
      result.exampleNotFound = self.constructErrorObject(
        ErrorCodes.XmsExampleNotFoundError, msg, null, true)
    }
    self.constructOperationResult(operation, result, Constants.xmsExamples)
    return
  }

  /*
   * Validates the example provided in the spec for the given operation if specified in the spec.
   *
   * @param {object} operation - The operation object.
   */
  validateExample(operation: any) {
    let self = this
    if (operation === null || operation === undefined || typeof operation !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.')
    }
    let result: any = {}
    result.requestValidation = self.validateExampleRequest(operation)
    result.responseValidation = self.validateExampleResponses(operation)
    self.constructOperationResult(operation, result, Constants.exampleInSpec)
    return
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
  validateRequest(operation: any, exampleParameterValues: any) {
    let self = this
    if (operation === null || operation === undefined || typeof operation !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.')
    }

    if (exampleParameterValues === null
      || exampleParameterValues === undefined
      || typeof exampleParameterValues !== 'object') {
      throw new Error(
        `In operation "${operation.operationId}", exampleParameterValues cannot be null or undefined and ` +
        `must be of type "object" (A dictionary of key-value pairs of parameter-names and their values).`)
    }

    let parameters = operation.getParameters()
    let result = {
      request: null,
      validationResult: { errors: [] as any[], warnings: [] }
    }
    let foundIssues = false
    let options: any = { headers: {} }
    let formDataFiles: any = null
    let parameterizedHost = operation.pathObject.api[Constants.xmsParameterizedHost]
    let hostTemplate = parameterizedHost && parameterizedHost.hostTemplate
      ? parameterizedHost.hostTemplate
      : null
    if (operation.pathObject
      && operation.pathObject.api
      && (operation.pathObject.api.host || hostTemplate)) {
      let scheme = 'https'
      let basePath = ''
      let host = ''
      host = operation.pathObject.api.host || hostTemplate
      if (host.endsWith('/'))
        host = host.slice(0, host.length - 1)
      if (operation.pathObject.api.schemes
        && !operation.pathObject.api.schemes.some(
          (item: any) => { return item && item.toLowerCase() === 'https'; }))
        scheme = operation.pathObject.api.schemes[0]
      if (operation.pathObject.api.basePath)
        basePath = operation.pathObject.api.basePath
      if (!basePath.startsWith('/'))
        basePath = `/${basePath}`
      let baseUrl = ''
      if (host.startsWith(scheme + '://'))
        baseUrl = `${host}${basePath}`
      else
        baseUrl = `${scheme}://${host}${basePath}`
      options.baseUrl = baseUrl
    }
    options.method = operation.method
    let pathTemplate = operation.pathObject.path
    if (pathTemplate && pathTemplate.includes("?")) {
      pathTemplate = pathTemplate.slice(0, pathTemplate.indexOf("?"))
      operation.pathObject.path = pathTemplate
    }
    options.pathTemplate = pathTemplate
    for (let i = 0; i < parameters.length; i++) {
      let parameter = parameters[i]
      let parameterValue = exampleParameterValues[parameter.name]
      if (!parameterValue) {
        if (parameter.required) {
          let msg =
            `In operation "${operation.operationId}", parameter ${parameter.name} is required in the ` +
            `swagger spec but is not present in the provided example parameter values.`
          let e = self.constructErrorObject(ErrorCodes.RequiredParameterExampleNotFound, msg)
          result.validationResult.errors.push(e)
          foundIssues = true
          break
        }
        continue
      }
      let location = parameter.in
      if (location === 'path' || location === 'query') {
        if (location === 'path' && parameterValue && typeof parameterValue.valueOf() === "string") {
          // "/{scope}/scopes/resourceGroups/{resourceGroupName}" In the aforementioned path template, we will search for the path parameter based on it's name
          // for example: "scope". Find it's index in the string and move backwards by 2 positions. If the character at that position is a forward slash "/" and
          // the value for the parameter starts with a forward slash "/" then we have found the case where there will be duplicate forward slashes in the url.
          if (pathTemplate.charAt(pathTemplate.indexOf(`${parameter.name}`) - 2)
            === '/' && parameterValue.startsWith('/')) {

            let msg =
              `In operation "${operation.operationId}", example for parameter "${parameter.name}": "${parameterValue}" starts with a forward slash ` +
              `and the path template: "${pathTemplate}" contains a forward slash before the parameter starts. This will cause double forward slashes ` +
              ` in the request url. Thus making it incorrect. Please rectify the example.`
            let e = self.constructErrorObject(ErrorCodes.DoubleForwardSlashesInUrl, msg)
            result.validationResult.errors.push(e)
            foundIssues = true
            break
          }
          // replacing forward slashes with empty string because this messes up Sways regex validation of path segment.
          parameterValue = parameterValue.replace(/\//ig, '')
        }
        let paramType = location + 'Parameters'
        if (!options[paramType]) options[paramType] = {}
        if (parameter[Constants.xmsSkipUrlEncoding] || utils.isUrlEncoded(parameterValue)) {
          options[paramType][parameter.name] = {
            value: parameterValue,
            skipUrlEncoding: true
          }
        } else {
          options[paramType][parameter.name] = parameterValue
        }
      } else if (location === 'body') {
        options.body = parameterValue
        options.disableJsonStringifyOnBody = true
        if (operation.consumes) {
          let isOctetStream = (consumes: any) => {
            return consumes.some((contentType: any) => {
              return contentType === 'application/octet-stream'
            })
          }

          if (parameter.schema.format === 'file' && isOctetStream(operation.consumes)) {
            options.headers['Content-Type'] = 'application/octet-stream'
          } else {
            options.headers['Content-Type'] = operation.consumes[0]
          }
        }
      } else if (location === 'header') {
        options.headers[parameter.name] = parameterValue
      } else if (location === 'formData') {
        // helper function
        let isFormUrlEncoded = (consumes: any) => {
          return consumes.some((contentType: any) => {
            return contentType === 'application/x-www-form-urlencoded'
          })
        }

        if (!options.formData) options.formData = {}
        options.formData[parameter.name] = parameterValue

        // set Content-Type correctly
        if (operation.consumes && isFormUrlEncoded(operation.consumes)) {
          options.headers['Content-Type'] = 'application/x-www-form-urlencoded'
        } else {
          // default to formData
          options.headers['Content-Type'] = 'multipart/form-data'
        }
        // keep track of parameter type 'file' as sway expects such parameter types to be set
        // differently in the request object given for validation.
        if (parameter.type === 'file') {
          if (!formDataFiles) formDataFiles = {}
          formDataFiles[parameter.name] = parameterValue
        }
      }
    }

    if (options.headers['content-type']) {
      let val = delete options.headers['content-type']
      options.headers['Content-Type'] = val
    }
    if (!options.headers['Content-Type']) {
      options.headers['Content-Type'] = utils.getJsonContentType(operation.consumes)
    }

    let request: any = null
    let validationResult: any = {}
    validationResult['errors'] = []
    if (!foundIssues) {
      try {
        request = new HttpRequest()
        request = request.prepare(options)
        // set formData in the way sway expects it.
        if (formDataFiles) {
          request.files = formDataFiles
        } else if (options.formData) {
          request.body = options.formData
        }
        validationResult = operation.validateRequest(request)
        self.sampleRequest = request
      } catch (err) {
        request = null
        let e = self.constructErrorObject(ErrorCodes.ErrorInPreparingRequest, err.message, [err])
        validationResult.errors.push(e)
      }
    }

    result.request = request
    result.validationResult = utils.mergeObjects(validationResult, result.validationResult)
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
  validateResponse(operationOrResponse: any, responseWrapper: any) {
    let self = this
    if (operationOrResponse === null
      || operationOrResponse === undefined
      || typeof operationOrResponse !== 'object') {
      throw new Error('operationOrResponse cannot be null or undefined and must be of type \'object\'.')
    }

    if (responseWrapper === null
      || responseWrapper === undefined || typeof responseWrapper !== 'object') {
      throw new Error('responseWrapper cannot be null or undefined and must be of type \'object\'.')
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
  validateExampleRequest(operation: any) {
    let self = this
    if (operation === null || operation === undefined || typeof operation !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.')
    }
    let parameters = operation.getParameters()
    //as per swagger specification https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#fixed-fields-13
    //example can only be provided in a schema and schema can only be provided for a body parameter. Hence, if the body
    //parameter schema has an example, then we will populate sample values for other parameters and create a request object.
    //This request object will be used to validate the body parameter example. Otherwise, we will skip it.
    let bodyParam = parameters.find(function (item: any) {
      return (item.in === 'body')
    })
    let result = {}
    if (bodyParam && bodyParam.schema && bodyParam.schema.example) {
      let exampleParameterValues: any = {}
      for (let i = 0; i < parameters.length; i++) {
        log.debug(
          `Getting sample value for parameter "${parameters[i].name}" in operation "${operation.operationId}".`)
        //need to figure out how to register custom format validators. Till then deleting the format uuid.
        if (parameters[i].format && parameters[i].format === 'uuid') {
          delete parameters[i].format
          delete parameters[i].schema.format
        }
        exampleParameterValues[parameters[i].name] = parameters[i].getSample()
      }
      exampleParameterValues[bodyParam.name] = bodyParam.schema.example
      result = self.validateRequest(operation, exampleParameterValues)
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
  validateXmsExampleResponses(operation: any, exampleResponseValue: any) {
    let self = this
    let result: any = {}
    if (operation === null || operation === undefined || typeof operation !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.')
    }

    if (exampleResponseValue === null
      || exampleResponseValue === undefined
      || typeof exampleResponseValue !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.')
    }
    let responsesInSwagger: any = {}
    let responses = operation.getResponses().map(function (response: any) {
      responsesInSwagger[response.statusCode] = response.statusCode
      return response.statusCode
    })
    for (let exampleResponseStatusCode of utils.getKeys(exampleResponseValue)) {
      let response = operation.getResponse(exampleResponseStatusCode)
      if (responsesInSwagger[exampleResponseStatusCode])
        delete responsesInSwagger[exampleResponseStatusCode]
      result[exampleResponseStatusCode] = { errors: [], warnings: [] }
      //have to ensure how to map negative status codes to default. There have been several issues filed in the Autorest repo, w.r.t how
      //default is handled. While solving that issue, we may come up with some extension. Once that is finalized, we should code accordingly over here.
      if (!response) {
        let msg =
          `Response statusCode "${exampleResponseStatusCode}" for operation ` +
          `"${operation.operationId}" is provided in exampleResponseValue, ` +
          `however it is not present in the swagger spec.`;
        let e = self.constructErrorObject(ErrorCodes.ResponseStatusCodeNotInSpec, msg)
        result[exampleResponseStatusCode].errors.push(e)
        log.error(e as any)
        continue
      }

      let exampleResponseHeaders = exampleResponseValue[exampleResponseStatusCode]['headers'] || {}
      let exampleResponseBody = exampleResponseValue[exampleResponseStatusCode]['body']
      if (exampleResponseBody && !response.schema) {
        let msg =
          `Response statusCode "${exampleResponseStatusCode}" for operation ` +
          `"${operation.operationId}" has response body provided in the example, ` +
          `however the response does not have a "schema" defined in the swagger spec.`
        let e = self.constructErrorObject(ErrorCodes.ResponseSchemaNotInSpec, msg)
        result[exampleResponseStatusCode].errors.push(e)
        log.error(e as any)
        continue
      }
      //ensure content-type header is present
      if (!(exampleResponseHeaders['content-type'] || exampleResponseHeaders['Content-Type'])) {
        exampleResponseHeaders['content-type'] = utils.getJsonContentType(operation.produces)
      }
      let exampleResponse = new ResponseWrapper(
        exampleResponseStatusCode, exampleResponseBody, exampleResponseHeaders)
      let validationResult = self.validateResponse(operation, exampleResponse)
      result[exampleResponseStatusCode] = validationResult
    }
    let responseWithoutXmsExamples = utils
      .getKeys(responsesInSwagger)
      .filter(function (statusCode: any) {
        if (statusCode !== 'default') {
          //let intStatusCode = parseInt(statusCode);
          //if (!isNaN(intStatusCode) && intStatusCode < 400) {
          return statusCode
          //}
        }
      })
    if (responseWithoutXmsExamples && responseWithoutXmsExamples.length) {
      let msg =
        `Following response status codes "${responseWithoutXmsExamples.toString()}" for ` +
        `operation "${operation.operationId}" were present in the swagger spec, ` +
        `however they were not present in x-ms-examples. Please provide them.`
      let e = self.constructErrorObject(ErrorCodes.ResponseStatusCodeNotInExample, msg)
      log.error(e as any)
      responseWithoutXmsExamples.forEach(function (statusCode: any) {
        result[statusCode] = { errors: [e] }
      })
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
  validateExampleResponses(operation: any) {
    let self = this
    if (operation === null || operation === undefined || typeof operation !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.')
    }
    let result: any = {}
    let responses = operation.getResponses()
    for (let i = 0; i < responses.length; i++) {
      let response = responses[i]
      if (response.examples) {
        for (let mimeType of Object.keys(response.examples)) {
          let exampleResponseBody = response.examples[mimeType]
          let exampleResponseHeaders = { 'content-type': mimeType }
          let exampleResponse = new ResponseWrapper(
            response.statusCode, exampleResponseBody, exampleResponseHeaders)
          let validationResult = self.validateResponse(operation, exampleResponse)
          result[response.statusCode] = validationResult
        }
      }
    }
    return result
  }

}

export = SpecValidator