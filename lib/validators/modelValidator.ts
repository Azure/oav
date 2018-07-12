import {
  SpecValidator,
  SpecValidationResult,
  ValidationResult,
  ValidationResultScenarios,
  RequestValidation,
  ExampleResponse
} from "./specValidator"
import { Unknown } from "../util/unknown"
import * as C from "../util/constants"
import * as utils from "../util/utils"
import { CommonError } from "../util/error"
import { ErrorCodes } from "../util/constants"
import { log } from "../util/logging"
import { StringMap } from "../util/stringMap"
import { Operation } from "yasway"
import * as Sway from "yasway"
import { ResponseWrapper } from "../models/responseWrapper"
import { OperationExampleResult } from "../util/scenarioReducer"

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
      const operationResult = this.specValidationResult.operations[operation.operationId]
      if (operationResult === undefined) {
        throw new Error("operationResult is undefined")
      }
      const example = operationResult[C.exampleInSpec]
      if (example === undefined) {
        throw new Error("example is undefined")
      }
      if (utils
          .getKeys(example)
          .length
        === 0) {
        delete operationResult[C.exampleInSpec]
      }
    }
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
      const example = operationResult[exampleType]
      if (!example || (example && !utils.getKeys(example).length)) {
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
    operationId: string, exampleType: string, scenarioName: string|undefined
  ): { operationResult: OperationExampleResult, part: string } {
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
    requestValidationErrors: CommonError[],
    requestValidationWarnings: Unknown[]|undefined,
    exampleType: string,
    scenarioName?: string
  ): void {

    this.initializeExampleResult(operationId, exampleType, scenarioName)
    let subMsg
    let infoMsg
    let errorMsg
    let warnMsg
    const { operationResult, part } = this.getExample(operationId, exampleType, scenarioName)
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
    responseValidationErrors: CommonError[],
    responseValidationWarnings: Unknown[]|undefined,
    exampleType: string,
    scenarioName?: string
  ): void {

    this.initializeExampleResult(operationId, exampleType, scenarioName)
    let subMsg
    let infoMsg
    let errorMsg
    let warnMsg
    const { operationResult, part } = this.getExample(operationId, exampleType, scenarioName)
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
   * Validates the x-ms-examples object for an operation if specified in the swagger spec.
   *
   * @param {object} operation - The operation object.
   */
  private validateXmsExamples(operation: Operation): void {
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
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
}
