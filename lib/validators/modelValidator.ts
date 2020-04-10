// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import * as amd from "@azure/openapi-markdown"
import { filter, toArray } from "@ts-common/iterator"
import { JsonRef } from "@ts-common/json"
import * as jsonParser from "@ts-common/json-parser"
import { getDescendantFilePosition } from "@ts-common/source-map"
import * as sm from "@ts-common/string-map"
import * as msRest from "ms-rest"
import * as Sway from "yasway"
import { ResponseWrapper } from "../models/responseWrapper"
import { CommonError } from "../util/commonError"
import * as C from "../util/constants"
import * as jsonUtils from "../util/jsonUtils"
import { log } from "../util/logging"
import { ModelValidationError } from "../util/modelValidationError"
import { processErrors, setPositionAndUrl } from "../util/processErrors"
import { MultipleScenarios, Scenario } from "../util/responseReducer"
import { OperationResultType } from "../util/scenarioReducer"
import * as utils from "../util/utils"
import { getTitle } from "./specTransformer"
import {
  ExampleResponse,
  RequestValidation,
  SpecValidationResult,
  SpecValidator,
  ValidationResult,
  ValidationResultScenarios
} from "./specValidator"

const HttpRequest = msRest.WebResource

export class ModelValidator extends SpecValidator<SpecValidationResult> {
  private exampleJsonMap = new Map<string, Sway.SwaggerObject>()
  /*
   * Validates the given operationIds or all the operations in the spec.
   *
   * @param {string} [operationIds] - A comma separated string specifying the operations to be
   * validated.
   * If not specified then the entire spec is validated.
   */
  public async validateOperations(operationIds?: string): Promise<void> {
    if (!this.swaggerApi) {
      throw new Error(
        // tslint:disable-next-line: max-line-length
        `Please call "specValidator.initialize()" before calling this method, so that swaggerApi is populated.`
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
      const operationIdsObj: sm.MutableStringMap<unknown> = {}
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
        "x-ms-examples": {},
        "example-in-spec": {}
      }
      await this.validateOperation(operation)
      const operationResult = this.specValidationResult.operations[operation.operationId]
      if (operationResult === undefined) {
        throw new Error("operationResult is undefined")
      }
      const example = operationResult[C.exampleInSpec]
      if (example === undefined) {
        throw new Error("example is undefined")
      }
      if (sm.isEmpty(sm.toStringMap(example))) {
        delete operationResult[C.exampleInSpec]
      }
    }
  }
  private async loadExamplesForOperation(exampleFilePath: string): Promise<void> {
    try {
      if (!this.exampleJsonMap.has(exampleFilePath)) {
        const exampleJson = await jsonUtils.parseJson(
          undefined,
          exampleFilePath,
          jsonParser.defaultErrorReport
        )
        this.exampleJsonMap.set(exampleFilePath, exampleJson)
      }
    } catch (error) {
      throw new Error(`Failed to load a reference example file ${exampleFilePath}. (${error})`)
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
      if (!example || (example && sm.isEmpty(sm.toStringMap(example)))) {
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
    exampleType: OperationResultType,
    scenarioName: string | undefined
  ): {
    operationResult: Scenario // OperationExampleResult
    part: string
  } {
    const operation = this.specValidationResult.operations[operationId]
    if (operation === undefined) {
      throw new Error("operation is undefined")
    }
    const example = operation[exampleType]
    if (example === undefined) {
      throw new Error("example is undefined")
    }
    if (exampleType === C.xmsExamples) {
      const scenarios = (example as MultipleScenarios).scenarios
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
        operationResult: example as Scenario,
        part: `for example in spec for operation "${operationId}"`
      }
    }
  }

  private constructRequestResultWrapper(
    operationId: string,
    requestValidationErrors: ModelValidationError[],
    requestValidationWarnings: unknown[] | undefined,
    exampleType: OperationResultType,
    scenarioName?: string,
    exampleFilePath?: string
  ): void {
    this.initializeExampleResult(operationId, exampleType, scenarioName)
    const { operationResult, part } = this.getExample(operationId, exampleType, scenarioName)
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
        requestValidationErrors,
        null,
        exampleFilePath
      )
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
    responseValidationErrors: ModelValidationError[],
    responseValidationWarnings: unknown[] | undefined,
    exampleType: OperationResultType,
    scenarioName?: string
  ): void {
    this.initializeExampleResult(operationId, exampleType, scenarioName)
    const { operationResult, part } = this.getExample(operationId, exampleType, scenarioName)
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
      this.constructResponseResult(operationResult, responseStatusCode, true, infoMsg)
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
    operation: Sway.Operation,
    result: ValidationResult,
    exampleType: OperationResultType,
    exampleFileMap?: Map<string, string>
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
        for (const [scenario, v] of sm.entries(result.scenarios)) {
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
            scenario,
            exampleFileMap !== undefined ? exampleFileMap.get(scenario) : undefined
          )
          // responseValidation
          const responseValidation = result.scenarios[scenario].responseValidation
          if (responseValidation === undefined) {
            throw new Error("responseValidation is undefined")
          }
          for (const [responseStatusCode, value] of sm.entries(responseValidation)) {
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
        toArray(sm.keys(result.requestValidation as sm.StringMap<unknown>)).length
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
      if (result.responseValidation && !sm.isEmpty(result.responseValidation)) {
        // responseValidation
        for (const [responseStatusCode, value] of sm.entries(result.responseValidation)) {
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
  private async validateXmsExamples(operation: Sway.Operation): Promise<void> {
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }
    const xmsExamples = operation[C.xmsExamples]
    const resultScenarios: ValidationResultScenarios = {}
    const result: ValidationResult = {
      scenarios: resultScenarios
    }
    const exampleFileMap = new Map<string, string>()
    if (xmsExamples) {
      for (const [scenario, xmsExampleFunc] of sm.entries<any>(xmsExamples)) {
        const xmsExample = xmsExampleFunc()
        resultScenarios[scenario] = {
          requestValidation: this.validateRequest(operation, xmsExample.parameters),
          responseValidation: this.validateXmsExampleResponses(operation, xmsExample.responses)
        }
        exampleFileMap.set(scenario, xmsExample.docPath)
        await this.loadExamplesForOperation(xmsExample.docPath)
      }
      result.scenarios = resultScenarios
    } else {
      const msg = `x-ms-example not found in ${operation.operationId}.`
      result.exampleNotFound = this.constructErrorObject({
        code: C.ErrorCodes.XmsExampleNotFoundError,
        message: msg,
        skipValidityStatusUpdate: true,
        source: operation.definition
      })
    }
    this.constructOperationResult(operation, result, C.xmsExamples, exampleFileMap)
  }

  /*
   * Validates the given operation.
   *
   * @param {object} operation - The operation object.
   */
  private async validateOperation(operation: Sway.Operation): Promise<void> {
    await this.validateXmsExamples(operation)
    this.validateExample(operation)
  }

  /*
   * Validates the example provided in the spec for the given operation if specified in the spec.
   *
   * @param {object} operation - The operation object.
   */
  private validateExample(operation: Sway.Operation): void {
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
  private validateExampleRequest(operation: Sway.Operation): RequestValidation {
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
      const exampleParameterValues: sm.MutableStringMap<object> = {}
      for (const parameter of parameters) {
        log.debug(
          `Getting sample value for parameter "${parameter.name}" in operation ` +
            `"${operation.operationId}".`
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
    operation: Sway.Operation
  ): sm.StringMap<Sway.ValidationResults> {
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }
    const result: sm.MutableStringMap<Sway.ValidationResults> = {}
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
  private validateResponse(operationOrResponse: Sway.Operation, responseWrapper: unknown) {
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
      throw new Error("responseWrapper cannot be null or undefined and must be of type 'object'.")
    }
    // this.sampleResponse = responseWrapper
    // TODO: update responseWrapper
    return operationOrResponse.validateResponse(responseWrapper as Sway.LiveResponse)
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
    operation: Sway.Operation,
    exampleResponseValue: { [name: string]: ExampleResponse }
  ) {
    const result: sm.MutableStringMap<Sway.ValidationResults> = {}
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }

    if (
      exampleResponseValue === null ||
      exampleResponseValue === undefined ||
      typeof exampleResponseValue !== "object"
    ) {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }
    const responsesInSwagger: sm.MutableStringMap<unknown> = {}
    operation.getResponses().forEach(response => {
      responsesInSwagger[response.statusCode] = response.statusCode
    })
    for (const exampleResponseStatusCode of sm.keys(exampleResponseValue)) {
      const response = operation.getResponse(exampleResponseStatusCode)
      if (responsesInSwagger[exampleResponseStatusCode]) {
        delete responsesInSwagger[exampleResponseStatusCode]
      }
      const validationResults: Sway.ValidationResults = {
        errors: [],
        warnings: []
      }
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
        const e = this.constructErrorObject<Sway.ValidationEntry>({
          code: C.ErrorCodes.ResponseStatusCodeNotInSpec,
          message: msg,
          source: operation.definition
        })
        validationResults.errors.push(e)
        log.error(e as any)
        continue
      }

      const exampleResponseHeaders = exampleResponseValue[exampleResponseStatusCode].headers || {}
      const exampleResponseBody = exampleResponseValue[exampleResponseStatusCode].body

      // Fail when example provides the response body but the swagger spec doesn't define the schema for the response.
      if (exampleResponseBody !== undefined && !response.schema) {
        const msg =
          `Response statusCode "${exampleResponseStatusCode}" for operation ` +
          `"${operation.operationId}" has response body provided in the example, ` +
          `however the response does not have a "schema" defined in the swagger spec.`
        const e = this.constructErrorObject<Sway.ValidationEntry>({
          code: C.ErrorCodes.ResponseSchemaNotInSpec,
          message: msg,
          source: operation.definition
        })
        validationResults.errors.push(e)
        log.error(e as any)
        continue
      } else if (exampleResponseBody === undefined && response.schema) {
        // Fail when example doesn't provide the response body but the swagger spec define the schema for the response.
        const msg =
          `Response statusCode "${exampleResponseStatusCode}" for operation ` +
          `"${operation.operationId}" has no response body provided in the example, ` +
          `however the response does have a "schema" defined in the swagger spec.`
        const e = this.constructErrorObject<Sway.ValidationEntry>({
          code: C.ErrorCodes.ResponseBodyNotInExample,
          message: msg,
          source: operation.definition
        })
        validationResults.errors.push(e)
        log.error(e as any)
        continue
      }

      // ensure content-type header is present
      if (!(exampleResponseHeaders["content-type"] || exampleResponseHeaders["Content-Type"])) {
        exampleResponseHeaders["content-type"] = utils.getJsonContentType(operation.produces)
      }
      const exampleResponse = new ResponseWrapper(
        exampleResponseStatusCode,
        exampleResponseBody,
        exampleResponseHeaders
      )
      const validationResult = this.validateResponse(operation, exampleResponse)
      result[exampleResponseStatusCode] = validationResult
    }
    const responseWithoutXmsExamples = toArray(
      filter(sm.keys(responsesInSwagger), statusCode => statusCode !== "default")
    )

    if (responseWithoutXmsExamples && responseWithoutXmsExamples.length) {
      const msg =
        `Following response status codes "${responseWithoutXmsExamples.toString()}" for ` +
        `operation "${operation.operationId}" were present in the swagger spec, ` +
        `however they were not present in x-ms-examples. Please provide them.`
      const e = this.constructErrorObject<Sway.ValidationEntry>({
        code: C.ErrorCodes.ResponseStatusCodeNotInExample,
        message: msg,
        source: operation.definition
      })
      setPositionAndUrl(e, getTitle(operation.definition))
      log.error(e as any)
      responseWithoutXmsExamples.forEach(statusCode => (result[statusCode] = { errors: [e] }))
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
    operation: Sway.Operation,
    exampleParameterValues: sm.StringMap<{}>
  ): RequestValidation {
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }

    if (
      exampleParameterValues === null ||
      exampleParameterValues === undefined ||
      typeof exampleParameterValues !== "object"
    ) {
      throw new Error(
        `In operation "${operation.operationId}", exampleParameterValues cannot be null or ` +
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
    let formDataFiles: sm.MutableStringMap<unknown> | null = null
    const pathObject = operation.pathObject
    const parameterizedHost = pathObject.api[C.xmsParameterizedHost]
    const useSchemePrefix = parameterizedHost
      ? (parameterizedHost as any).useSchemePrefix === undefined
        ? true
        : (parameterizedHost as any).useSchemePrefix
      : null
    const hostTemplate =
      parameterizedHost && parameterizedHost.hostTemplate ? parameterizedHost.hostTemplate : null
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
        !operation.pathObject.api.schemes.some(item => !!item && item.toLowerCase() === "https")
      ) {
        scheme = operation.pathObject.api.schemes[0]
      }
      if (operation.pathObject.api.basePath) {
        basePath = operation.pathObject.api.basePath
      }
      if (!basePath.startsWith("/")) {
        basePath = `/${basePath}`
      }
      const baseUrl =
        host.startsWith(scheme + "://") || (hostTemplate && !useSchemePrefix)
          ? `${host}${basePath}`
          : `${scheme}://${host}${basePath}`
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
          const e = this.constructErrorObject<Sway.ValidationEntry>({
            code: C.ErrorCodes.RequiredParameterExampleNotFound,
            message: msg,
            source: parameter.definition
          })
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
          if (
            pathTemplate.charAt(pathTemplate.indexOf(`${parameter.name}`) - 2) === "/" &&
            parameterValue.startsWith("/")
          ) {
            const msg =
              `In operation "${operation.operationId}", example for parameter ` +
              `"${parameter.name}": "${parameterValue}" starts with a forward slash ` +
              `and the path template: "${pathTemplate}" contains a forward slash before ` +
              `the parameter starts. This will cause double forward slashes ` +
              ` in the request url. Thus making it incorrect. Please rectify the example.`
            const e = this.constructErrorObject<Sway.ValidationEntry>({
              code: C.ErrorCodes.DoubleForwardSlashesInUrl,
              message: msg,
              source: parameter.definition
            })
            if (result.validationResult === undefined) {
              throw new Error("result.validationResult is undefined")
            }
            result.validationResult.errors.push(e)
            foundIssues = true
            break
          }

          // replacing characters that may cause validator failed  with empty string because this messes up Sways regex
          // validation of path segment.
          parameterValue = parameterValue.replace(/\//gi, "")

          // replacing scheme that may cause validator failed when x-ms-parameterized-host enbaled & useSchemePrefix enabled
          // because if useSchemePrefix enabled ,the parameter value in x-ms-parameterized-host should not has the scheme (http://|https://)
          if (useSchemePrefix) {
            parameterValue = (parameterValue as string).replace(/^https{0,1}:/gi, "")
          }
        }
        const paramType = location + "Parameters"
        if (!options[paramType]) {
          options[paramType] = {}
        }
        if (parameter[C.xmsSkipUrlEncoding] || utils.isUrlEncoded(parameterValue as string)) {
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
            consumes.some(contentType => contentType === "application/octet-stream")

          options.headers["Content-Type"] =
            parameter.schema.format === "file" && isOctetStream(operation.consumes)
              ? "application/octet-stream"
              : operation.consumes[0]
        }
      } else if (location === "header") {
        options.headers[parameter.name] = parameterValue
      } else if (location === "formData") {
        // helper function
        const isFormUrlEncoded = (consumes: string[]) =>
          consumes.some(contentType => contentType === "application/x-www-form-urlencoded")

        if (!options.formData) {
          options.formData = {}
        }
        options.formData[parameter.name] = parameterValue

        // set Content-Type correctly
        options.headers["Content-Type"] =
          operation.consumes && isFormUrlEncoded(operation.consumes)
            ? "application/x-www-form-urlencoded"
            : // default to formData
              "multipart/form-data"
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
      options.headers["Content-Type"] = utils.getJsonContentType(operation.consumes)
    }

    let request: (msRest.WebResource & { files?: sm.MutableStringMap<unknown> }) | null = null
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
        const e = this.constructErrorObject({
          code: C.ErrorCodes.ErrorInPreparingRequest,
          message: err.message,
          innerErrors: [err]
        })
        validationResult.errors.push(e)
      }
    }

    result.request = request
    result.validationResult = utils.mergeObjects(validationResult, result.validationResult as any)
    return result
  }

  private constructRequestResult(
    operationResult: Scenario, // OperationExampleResult,
    isValid: unknown,
    msg: string,
    requestValidationErrors?: ModelValidationError[] | null,
    requestValidationWarnings?: unknown,
    exampleFilePath?: string
  ): void {
    if (operationResult.request === undefined) {
      throw new Error("operationResult.result is undefined")
    }

    if (!isValid) {
      operationResult.isValid = false
      operationResult.request.isValid = false
      if (!!requestValidationErrors && requestValidationErrors.length > 0) {
        if (exampleFilePath !== undefined) {
          requestValidationErrors.forEach(error => {
            const positionInfo = getDescendantFilePosition(
              this.exampleJsonMap.get(exampleFilePath) as JsonRef,
              error.path
            )
            if (!error.path) {
              error.path = ""
            }
            const titleObj: any = {
              path: Array.isArray(error.path) ? [...error.path] : [error.path],
              position: positionInfo,
              url: exampleFilePath
            }
            error.title = JSON.stringify(titleObj)
          })
          // process suppression for request validation errors
          if (this.suppression) {
            const requestParameterSuppressions = this.suppression.directive.filter(
              item => item.suppress === "INVALID_REQUEST_PARAMETER"
            )
            if (requestParameterSuppressions && requestParameterSuppressions.length > 0) {
              requestValidationErrors = this.applySuppression(
                requestValidationErrors,
                requestParameterSuppressions
              )
            }
          }
        }
      }
      if (requestValidationErrors && requestValidationErrors.length > 0) {
        const e = this.constructErrorObject({
          code: C.ErrorCodes.RequestValidationError,
          message: msg,
          innerErrors: requestValidationErrors
        })
        operationResult.request.error = e
        log.error(`${msg}:\n`, e)
      } else {
        msg = "Request parameters is valid."
        operationResult.request.isValid = true
        operationResult.request.result = msg
        log.info(`${msg}`)
      }
    } else if (requestValidationWarnings) {
      operationResult.request.warning = requestValidationWarnings
      log.debug(`${msg}:\n`, requestValidationWarnings)
    } else {
      operationResult.request.isValid = true
      operationResult.request.result = msg
      log.info(`${msg}`)
    }
  }

  private applySuppression(
    errors: ModelValidationError[],
    suppressionItems: amd.SuppressionItem[]
  ): ModelValidationError[] {
    const notSuppressedErrors: ModelValidationError[] = []
    errors.forEach(item => {
      if (!item.message || !this.existSuppression(suppressionItems, item.message)) {
        notSuppressedErrors.push(item)
      }
    })
    return notSuppressedErrors
  }

  private existSuppression(suppressionItems: amd.SuppressionItem[], message: string): boolean {
    for (const item of suppressionItems) {
      if (item["text-matches"] !== undefined) {
        const regex = new RegExp(item["text-matches"])
        if (regex.test(message)) {
          return true
        }
      }
    }
    return false
  }

  private constructResponseResult(
    operationResult: Scenario, // OperationExampleResult,
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
      const e = this.constructErrorObject({
        code: C.ErrorCodes.ResponseValidationError,
        message: msg,
        innerErrors: responseValidationErrors
      })
      operationResult.responses[responseStatusCode].error = e
      const pe = processErrors([e])
      log.error(`${msg}:\n`, pe)
    } else if (responseValidationWarnings) {
      operationResult.responses[responseStatusCode].warning = responseValidationWarnings
      log.debug(`${msg}:\n`, responseValidationWarnings)
    } else {
      operationResult.responses[responseStatusCode].isValid = true
      operationResult.responses[responseStatusCode].result = msg
      log.info(`${msg}`)
    }
  }
}
