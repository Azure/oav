// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import {
  SpecValidator,
  SpecValidationResult,
  ValidationResult,
  ValidationResultScenarios,
  RequestValidation,
  ExampleResponse
} from "./specValidator"
import * as C from "../util/constants"
import * as utils from "../util/utils"
import { CommonError } from "../util/commonError"
import { ErrorCodes } from "../util/constants"
import { log } from "../util/logging"
import { StringMap, MutableStringMap, entries, keys } from "@ts-common/string-map"
import { Operation } from "yasway"
import * as Sway from "yasway"
import { ResponseWrapper } from "../models/responseWrapper"
import { OperationExampleResult } from "../util/scenarioReducer"
import { ModelValidationError } from "../util/modelValidationError"
import * as msRest from "ms-rest"
import { toArray, filter } from "@ts-common/iterator"

const HttpRequest = msRest.WebResource

export class ModelValidator extends SpecValidator<SpecValidationResult> {
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
          `is populated.`
      )
    }
    if (
      operationIds !== null &&
      operationIds !== undefined &&
      typeof operationIds.valueOf() !== "string"
    ) {
      throw new Error(`operationIds parameter must be of type 'string'.`)
    }

    let operations = this.swaggerApi.getOperations()
    if (operationIds) {
      const operationIdsObj: { [name: string]: unknown } = {}
      operationIds
        .trim()
        .split(",")
        .forEach(item => (operationIdsObj[item.trim()] = 1))
      const operationsToValidate = operations.filter(item =>
        Boolean(operationIdsObj[item.operationId])
      )
      if (operationsToValidate.length) {
        operations = operationsToValidate
      }
    }

    for (const operation of operations) {
      this.specValidationResult.operations[operation.operationId] = {
        [C.xmsExamples]: {},
        [C.exampleInSpec]: {}
      }
      this.validateOperation(operation)
      const operationResult = this.specValidationResult.operations[
        operation.operationId
      ]
      if (operationResult === undefined) {
        throw new Error("operationResult is undefined")
      }
      const example = operationResult[C.exampleInSpec]
      if (example === undefined) {
        throw new Error("example is undefined")
      }
      if (toArray(keys(example as StringMap<unknown>)).length === 0) {
        delete operationResult[C.exampleInSpec]
      }
    }
  }

  private initializeExampleResult(
    operationId: string,
    exampleType: string,
    scenarioName: string | undefined
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
      const example = operationResult[exampleType]
      if (!example || (example && !toArray(keys(example as StringMap<unknown>)).length)) {
        operationResult[exampleType] = initialResult
      }
    }

    if (exampleType === C.xmsExamples) {
      const example = operationResult[exampleType]
      if (example === undefined) {
        throw new Error("example is undefined")
      }
      if (!example.scenarios) {
        example.scenarios = {}
      }
      if (scenarioName === undefined) {
        throw new Error("scenarioName === undefined")
      }
      if (!example.scenarios[scenarioName]) {
        example.scenarios[scenarioName] = initialResult
      }
    }
    this.specValidationResult.operations[operationId] = operationResult
  }

  private getExample(
    operationId: string,
    exampleType: string,
    scenarioName: string | undefined
  ): { operationResult: OperationExampleResult; part: string } {
    const operation = this.specValidationResult.operations[operationId]
    if (operation === undefined) {
      throw new Error("operation is undefined")
    }
    const example = operation[exampleType]
    if (example === undefined) {
      throw new Error("example is undefined")
    }
    if (exampleType === C.xmsExamples) {
      const scenarios = example.scenarios
      if (scenarios === undefined) {
        throw new Error("scenarios is undefined")
      }
      const scenario = scenarios[scenarioName as string]
      if (scenario === undefined) {
        throw new Error("scenario is undefined")
      }
      return {
        operationResult: scenario,
        part: `for x-ms-example "${scenarioName}" in operation "${operationId}"`
      }
    } else {
      return {
        operationResult: example,
        part: `for example in spec for operation "${operationId}"`
      }
    }
  }

  private constructRequestResultWrapper(
    operationId: string,
    requestValidationErrors: ModelValidationError[],
    requestValidationWarnings: Array<unknown> | undefined,
    exampleType: string,
    scenarioName?: string
  ): void {
    this.initializeExampleResult(operationId, exampleType, scenarioName)
    const { operationResult, part } = this.getExample(
      operationId,
      exampleType,
      scenarioName
    )
    const subMsg = `validating the request ${part}`
    const infoMsg = `Request parameters ${part} is valid.`
    let errorMsg
    let warnMsg
    if (requestValidationErrors && requestValidationErrors.length) {
      errorMsg = `Found errors in ${subMsg}.`
      this.constructRequestResult(
        operationResult,
        false,
        errorMsg,
        requestValidationErrors
      )
    } else {
      this.constructRequestResult(operationResult, true, infoMsg)
    }
    if (requestValidationWarnings && requestValidationWarnings.length) {
      warnMsg = `Found warnings in ${subMsg}.`
      this.constructRequestResult(
        operationResult,
        true,
        warnMsg,
        null,
        requestValidationWarnings
      )
    }
  }

  private constructResponseResultWrapper(
    operationId: string,
    responseStatusCode: string,
    responseValidationErrors: ModelValidationError[],
    responseValidationWarnings: Array<unknown> | undefined,
    exampleType: string,
    scenarioName?: string
  ): void {
    this.initializeExampleResult(operationId, exampleType, scenarioName)
    const { operationResult, part } = this.getExample(
      operationId,
      exampleType,
      scenarioName
    )
    const subMsg = `validating the response with statusCode "${responseStatusCode}" ${part}`
    const infoMsg = `Response with statusCode "${responseStatusCode}" ${part} is valid.`
    let errorMsg
    let warnMsg
    if (responseValidationErrors && responseValidationErrors.length) {
      errorMsg = `Found errors in ${subMsg}.`
      this.constructResponseResult(
        operationResult,
        responseStatusCode,
        false,
        errorMsg,
        responseValidationErrors
      )
    } else {
      this.constructResponseResult(
        operationResult,
        responseStatusCode,
        true,
        infoMsg
      )
    }
    if (responseValidationWarnings && responseValidationWarnings.length) {
      warnMsg = `Found warnings in ${subMsg}.`
      this.constructResponseResult(
        operationResult,
        responseStatusCode,
        true,
        warnMsg,
        null,
        responseValidationWarnings
      )
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
    operation: Operation,
    result: ValidationResult,
    exampleType: string
  ): void {
    const operationId = operation.operationId
    if (result.exampleNotFound) {
      const operationResult = this.specValidationResult.operations[operationId]
      if (operationResult === undefined) {
        throw new Error("example is undefined")
      }
      const example = operationResult[exampleType]
      if (example === undefined) {
        throw new Error("example is undefined")
      }
      example.error = result.exampleNotFound
      // log.error(result.exampleNotFound)
    }
    if (exampleType === C.xmsExamples) {
      if (result.scenarios) {
        for (const [scenario, v] of entries(result.scenarios)) {
          const requestValidation = v.requestValidation
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
            operationId,
            requestValidationErrors,
            requestValidationWarnings,
            exampleType,
            scenario
          )
          // responseValidation
          const responseValidation =
            result.scenarios[scenario].responseValidation
          if (responseValidation === undefined) {
            throw new Error("responseValidation is undefined")
          }
          for (const [responseStatusCode, value] of entries(responseValidation)) {
            this.constructResponseResultWrapper(
              operationId,
              responseStatusCode,
              value.errors,
              value.warnings,
              exampleType,
              scenario
            )
          }
        }
      }
    } else if (exampleType === C.exampleInSpec) {
      if (
        result.requestValidation &&
        toArray(keys(result.requestValidation as StringMap<unknown>)).length
      ) {
        // requestValidation
        const validationResult = result.requestValidation.validationResult
        if (validationResult === undefined) {
          throw new Error("validationResult is undefined")
        }
        const requestValidationErrors = validationResult.errors
        const requestValidationWarnings = validationResult.warnings
        this.constructRequestResultWrapper(
          operationId,
          requestValidationErrors,
          requestValidationWarnings,
          exampleType
        )
      }
      if (
        result.responseValidation &&
        toArray(keys(result.responseValidation)).length
      ) {
        // responseValidation
        for (const [responseStatusCode, value] of entries(result.responseValidation)) {
          this.constructResponseResultWrapper(
            operationId,
            responseStatusCode,
            value.errors,
            value.warnings,
            exampleType
          )
        }
      }
    }
  }

  /*
   * Validates the x-ms-examples object for an operation if specified in the swagger spec.
   *
   * @param {object} operation - The operation object.
   */
  private validateXmsExamples(operation: Operation): void {
    if (
      operation === null ||
      operation === undefined ||
      typeof operation !== "object"
    ) {
      throw new Error(
        "operation cannot be null or undefined and must be of type 'object'."
      )
    }
    const xmsExamples = operation[C.xmsExamples]
    const resultScenarios: ValidationResultScenarios = {}
    const result: ValidationResult = {
      scenarios: resultScenarios
    }
    if (xmsExamples) {
      for (const scenario of Object.keys(xmsExamples)) {
        const xmsExample = xmsExamples[scenario]
        resultScenarios[scenario] = {
          requestValidation: this.validateRequest(
            operation,
            xmsExample.parameters
          ),
          responseValidation: this.validateXmsExampleResponses(
            operation,
            xmsExample.responses
          )
        }
      }
      result.scenarios = resultScenarios
    } else {
      const msg = `x-ms-example not found in ${operation.operationId}.`
      result.exampleNotFound = this.constructErrorObject(
        ErrorCodes.XmsExampleNotFoundError,
        msg,
        null,
        true
      )
    }
    this.constructOperationResult(operation, result, C.xmsExamples)
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
   * Validates the example provided in the spec for the given operation if specified in the spec.
   *
   * @param {object} operation - The operation object.
   */
  private validateExample(operation: Operation): void {
    if (
      operation === null ||
      operation === undefined ||
      typeof operation !== "object"
    ) {
      throw new Error(
        "operation cannot be null or undefined and must be of type 'object'."
      )
    }
    const result: ValidationResult = {
      requestValidation: this.validateExampleRequest(operation),
      responseValidation: this.validateExampleResponses(operation) as any
    }
    this.constructOperationResult(operation, result, C.exampleInSpec)
  }

  /*
   * Validates the example (request) for an operation if specified in the swagger spec.
   *
   * @param {object} operation - The operation object.
   *
   * @return {object} result - The validation result.
   */
  private validateExampleRequest(operation: Operation): RequestValidation {
    if (
      operation === null ||
      operation === undefined ||
      typeof operation !== "object"
    ) {
      throw new Error(
        "operation cannot be null or undefined and must be of type 'object'."
      )
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
      const exampleParameterValues: { [name: string]: object } = {}
      for (const parameter of parameters) {
        log.debug(
          `Getting sample value for parameter "${
            parameter.name
          }" in operation ` + `"${operation.operationId}".`
        )
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
   * Validates the example responses for a given operation.
   *
   * @param {object} operation - The operation object.
   *
   * @return {object} result - The validation result.
   */
  private validateExampleResponses(
    operation: Operation
  ): StringMap<Sway.ValidationResults> {
    if (
      operation === null ||
      operation === undefined ||
      typeof operation !== "object"
    ) {
      throw new Error(
        "operation cannot be null or undefined and must be of type 'object'."
      )
    }
    const result: MutableStringMap<Sway.ValidationResults> = {}
    const responses = operation.getResponses()
    for (const response of responses) {
      if (response.examples) {
        for (const mimeType of Object.keys(response.examples)) {
          const exampleResponseBody = response.examples[mimeType]
          const exampleResponseHeaders = { "content-type": mimeType }
          const exampleResponse = new ResponseWrapper(
            response.statusCode,
            exampleResponseBody,
            exampleResponseHeaders
          )
          const validationResult = this.validateResponse(
            operation,
            exampleResponse
          )
          result[response.statusCode] = validationResult
        }
      }
    }
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
  private validateResponse(
    operationOrResponse: Operation,
    responseWrapper: unknown
  ) {
    if (
      operationOrResponse === null ||
      operationOrResponse === undefined ||
      typeof operationOrResponse !== "object"
    ) {
      throw new Error(
        "operationOrResponse cannot be null or undefined and must be of type 'object'."
      )
    }

    if (
      responseWrapper === null ||
      responseWrapper === undefined ||
      typeof responseWrapper !== "object"
    ) {
      throw new Error(
        "responseWrapper cannot be null or undefined and must be of type 'object'."
      )
    }
    // this.sampleResponse = responseWrapper
    // TODO: update responseWrapper
    return operationOrResponse.validateResponse(
      responseWrapper as Sway.LiveResponse
    )
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
    const result: MutableStringMap<Sway.ValidationResults> = {}
    if (
      operation === null ||
      operation === undefined ||
      typeof operation !== "object"
    ) {
      throw new Error(
        "operation cannot be null or undefined and must be of type 'object'."
      )
    }

    if (
      exampleResponseValue === null ||
      exampleResponseValue === undefined ||
      typeof exampleResponseValue !== "object"
    ) {
      throw new Error(
        "operation cannot be null or undefined and must be of type 'object'."
      )
    }
    const responsesInSwagger: MutableStringMap<unknown> = {}
    operation.getResponses().forEach(response => {
      responsesInSwagger[response.statusCode] = response.statusCode
    })
    for (const exampleResponseStatusCode of keys(exampleResponseValue)) {
      const response = operation.getResponse(exampleResponseStatusCode)
      if (responsesInSwagger[exampleResponseStatusCode]) {
        delete responsesInSwagger[exampleResponseStatusCode]
      }
      const validationResults: Sway.ValidationResults = { errors: [], warnings: [] }
      result[exampleResponseStatusCode] = validationResults
      // have to ensure how to map negative status codes to default. There have been several issues
      // filed in the Autorest repo, w.r.t how
      // default is handled. While solving that issue, we may come up with some extension. Once that
      // is finalized, we should code accordingly over here.
      if (!response) {
        const msg =
          `Response statusCode "${exampleResponseStatusCode}" for operation ` +
          `"${operation.operationId}" is provided in exampleResponseValue, ` +
          `however it is not present in the swagger spec.`
        const e = this.constructErrorObject<Sway.ValidationEntry>(
          ErrorCodes.ResponseStatusCodeNotInSpec,
          msg
        )
        validationResults.errors.push(e)
        log.error(e as any)
        continue
      }

      const exampleResponseHeaders =
        exampleResponseValue[exampleResponseStatusCode].headers || {}
      const exampleResponseBody =
        exampleResponseValue[exampleResponseStatusCode].body
      if (exampleResponseBody && !response.schema) {
        const msg =
          `Response statusCode "${exampleResponseStatusCode}" for operation ` +
          `"${
            operation.operationId
          }" has response body provided in the example, ` +
          `however the response does not have a "schema" defined in the swagger spec.`
        const e = this.constructErrorObject<Sway.ValidationEntry>(
          ErrorCodes.ResponseSchemaNotInSpec,
          msg
        )
        validationResults.errors.push(e)
        log.error(e as any)
        continue
      }
      // ensure content-type header is present
      if (
        !(
          exampleResponseHeaders["content-type"] ||
          exampleResponseHeaders["Content-Type"]
        )
      ) {
        exampleResponseHeaders["content-type"] = utils.getJsonContentType(
          operation.produces
        )
      }
      const exampleResponse = new ResponseWrapper(
        exampleResponseStatusCode,
        exampleResponseBody,
        exampleResponseHeaders
      )
      const validationResult = this.validateResponse(operation, exampleResponse)
      result[exampleResponseStatusCode] = validationResult
    }
    const responseWithoutXmsExamples =
      toArray(filter(keys(responsesInSwagger), statusCode => statusCode !== "default"))

    if (responseWithoutXmsExamples && responseWithoutXmsExamples.length) {
      const msg =
        `Following response status codes "${responseWithoutXmsExamples.toString()}" for ` +
        `operation "${
          operation.operationId
        }" were present in the swagger spec, ` +
        `however they were not present in x-ms-examples. Please provide them.`
      const e = this.constructErrorObject<Sway.ValidationEntry>(
        ErrorCodes.ResponseStatusCodeNotInExample,
        msg
      )
      log.error(e as any)
      responseWithoutXmsExamples.forEach(
        statusCode => (result[statusCode] = { errors: [e] })
      )
    }
    return result
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
    operation: Operation,
    exampleParameterValues: { [name: string]: {} }
  ): RequestValidation {
    if (
      operation === null ||
      operation === undefined ||
      typeof operation !== "object"
    ) {
      throw new Error(
        "operation cannot be null or undefined and must be of type 'object'."
      )
    }

    if (
      exampleParameterValues === null ||
      exampleParameterValues === undefined ||
      typeof exampleParameterValues !== "object"
    ) {
      throw new Error(
        `In operation "${
          operation.operationId
        }", exampleParameterValues cannot be null or ` +
          `undefined and must be of type "object" (A dictionary of key-value pairs of ` +
          `parameter-names and their values).`
      )
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
    let formDataFiles: MutableStringMap<unknown> | null = null
    const pathObject = operation.pathObject as Sway.Path
    const parameterizedHost = pathObject.api[C.xmsParameterizedHost]
    const hostTemplate =
      parameterizedHost && parameterizedHost.hostTemplate
        ? parameterizedHost.hostTemplate
        : null
    if (
      operation.pathObject &&
      operation.pathObject.api &&
      (operation.pathObject.api.host || hostTemplate)
    ) {
      let scheme = "https"
      let basePath = ""
      let host = ""
      host = operation.pathObject.api.host || hostTemplate
      if (host.endsWith("/")) {
        host = host.slice(0, host.length - 1)
      }
      if (
        operation.pathObject.api.schemes &&
        !operation.pathObject.api.schemes.some(
          item => !!item && item.toLowerCase() === "https"
        )
      ) {
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
            `In operation "${operation.operationId}", parameter ${
              parameter.name
            } is required in ` +
            `the swagger spec but is not present in the provided example parameter values.`
          const e = this.constructErrorObject<Sway.ValidationEntry>(
            ErrorCodes.RequiredParameterExampleNotFound,
            msg
          )
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
        if (
          location === "path" &&
          parameterValue &&
          typeof parameterValue === "string"
        ) {
          // "/{scope}/scopes/resourceGroups/{resourceGroupName}" In the aforementioned path
          // template, we will search for the path parameter based on it's name
          // for example: "scope". Find it's index in the string and move backwards by 2 positions.
          // If the character at that position is a forward slash "/" and
          // the value for the parameter starts with a forward slash "/" then we have found the case
          // where there will be duplicate forward slashes in the url.
          if (
            pathTemplate.charAt(
              pathTemplate.indexOf(`${parameter.name}`) - 2
            ) === "/" &&
            parameterValue.startsWith("/")
          ) {
            const msg =
              `In operation "${
                operation.operationId
              }", example for parameter ` +
              `"${
                parameter.name
              }": "${parameterValue}" starts with a forward slash ` +
              `and the path template: "${pathTemplate}" contains a forward slash before ` +
              `the parameter starts. This will cause double forward slashes ` +
              ` in the request url. Thus making it incorrect. Please rectify the example.`
            const e = this.constructErrorObject<Sway.ValidationEntry>(
              ErrorCodes.DoubleForwardSlashesInUrl,
              msg
            )
            if (result.validationResult === undefined) {
              throw new Error("result.validationResult is undefined")
            }
            result.validationResult.errors.push(e)
            foundIssues = true
            break
          }
          // replacing forward slashes with empty string because this messes up Sways regex
          // validation of path segment.
          parameterValue = parameterValue.replace(/\//gi, "")
        }
        const paramType = location + "Parameters"
        if (!options[paramType]) {
          options[paramType] = {}
        }
        if (
          parameter[C.xmsSkipUrlEncoding] ||
          utils.isUrlEncoded(parameterValue as string)
        ) {
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
          const isOctetStream = (consumes: string[]) =>
            consumes.some(
              contentType => contentType === "application/octet-stream"
            )

          options.headers["Content-Type"] =
            parameter.schema.format === "file" &&
            isOctetStream(operation.consumes)
              ? "application/octet-stream"
              : operation.consumes[0]
        }
      } else if (location === "header") {
        options.headers[parameter.name] = parameterValue
      } else if (location === "formData") {
        // helper function
        const isFormUrlEncoded = (consumes: string[]) =>
          consumes.some(
            contentType => contentType === "application/x-www-form-urlencoded"
          )

        if (!options.formData) {
          options.formData = {}
        }
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
          if (!formDataFiles) {
            formDataFiles = {}
          }
          formDataFiles[parameter.name] = parameterValue
        }
      }
    }

    if (options.headers["content-type"]) {
      const val = delete options.headers["content-type"]
      options.headers["Content-Type"] = val
    }
    if (!options.headers["Content-Type"]) {
      options.headers["Content-Type"] = utils.getJsonContentType(
        operation.consumes
      )
    }

    let request:
      | (msRest.WebResource & { files?: MutableStringMap<unknown> })
      | null = null
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
          request.files = formDataFiles
        } else if (options.formData) {
          request.body = options.formData
        }
        validationResult = operation.validateRequest(request)
        // this.sampleRequest = request
      } catch (err) {
        request = null
        const e = this.constructErrorObject(
          ErrorCodes.ErrorInPreparingRequest,
          err.message,
          [err]
        )
        validationResult.errors.push(e)
      }
    }

    result.request = request
    result.validationResult = utils.mergeObjects(
      validationResult,
      result.validationResult as any
    )
    return result
  }

  private constructRequestResult(
    operationResult: OperationExampleResult,
    isValid: unknown,
    msg: string,
    requestValidationErrors?: ModelValidationError[] | null,
    requestValidationWarnings?: unknown
  ): void {
    if (operationResult.request === undefined) {
      throw new Error("operationResult.result is undefined")
    }

    if (!isValid) {
      operationResult.isValid = false
      operationResult.request.isValid = false
      const e = this.constructErrorObject(
        ErrorCodes.RequestValidationError,
        msg,
        requestValidationErrors
      )
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
    operationResult: OperationExampleResult,
    responseStatusCode: string,
    isValid: unknown,
    msg: string,
    responseValidationErrors?: ModelValidationError[] | null,
    responseValidationWarnings?: unknown
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
        ErrorCodes.ResponseValidationError,
        msg,
        responseValidationErrors
      )
      operationResult.responses[responseStatusCode].error = e
      log.error(`${msg}:\n`, e)
    } else if (responseValidationWarnings) {
      operationResult.responses[
        responseStatusCode
      ].warning = responseValidationWarnings
      log.debug(`${msg}:\n`, responseValidationWarnings)
    } else {
      operationResult.responses[responseStatusCode].isValid = true
      operationResult.responses[responseStatusCode].result = msg
      log.info(`${msg}`)
    }
  }
}
