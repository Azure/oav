// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as JsonRefs from "json-refs"
import * as fs from "fs"
import * as path from "path"
import * as utils from "./util/utils"
import * as Sway from "yasway"
import * as msRest from "ms-rest"

const HttpRequest = msRest.WebResource

import { log } from "./util/logging"
import { SpecResolver } from "./validators/specResolver"
import { ResponseWrapper } from "./models/responseWrapper"
import { MarkdownHttpTemplate } from "./templates/markdownHttpTemplate"
import { YamlHttpTemplate } from "./templates/yamlHttpTemplate"
import * as C from "./util/constants"

const ErrorCodes = C.ErrorCodes

export class WireFormatGenerator {
  private specPath: any
  private specDir: any
  private wireFormatDir: any
  private emitYaml: any
  private specInJson: any
  private specResolver: any
  private swaggerApi: any
  private options: any
  private specValidationResult: any
  constructor(specPath: any, specInJson: any, wireFormatDir: any, emitYaml: any) {
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
    let wfDir = path.join(this.specDir, "wire-format")
    if (specPath.startsWith("https://")) {
      wfDir = process.cwd() + "/wire-format"
    }
    this.wireFormatDir = wireFormatDir || wfDir
    if (!fs.existsSync(this.wireFormatDir)) {
      fs.mkdirSync(this.wireFormatDir)
    }
    this.emitYaml = emitYaml || false
    this.specInJson = specInJson
    this.specResolver = null
    this.swaggerApi = null
    this.options = {
      shouldResolveRelativePaths: true
    }
  }

  public async initialize(): Promise<Sway.SwaggerApi> {
    const self = this
    if (self.options.shouldResolveRelativePaths) {
      utils.clearCache()
    }
    try {
      const result = await utils.parseJson(self.specPath)
      self.specInJson = result
      const specOptions = {
        shouldResolveRelativePaths: true,
        shouldResolveXmsExamples: false,
        shouldResolveAllOf: false,
        shouldSetAdditionalPropertiesFalse: false,
        shouldResolvePureObjects: false
      }
      self.specResolver = new SpecResolver(self.specPath, self.specInJson, specOptions)
      await self.specResolver.resolve()
      await self.resolveExamples()
      const options: any = {
        definition: self.specInJson,
        jsonRefs: { relativeBase: self.specDir }
      }
      const api = await Sway.create(options)
      self.swaggerApi = api
      return api
    } catch (err) {
      const e = self.constructErrorObject(ErrorCodes.ResolveSpecError, err.message, [err])
      // self.specValidationResult.resolveSpec = e;
      log.error(`${ErrorCodes.ResolveSpecError.name}: ${err.message}.`)
      log.error(err.stack)
      throw e
    }
  }

  /*
   * Generates wire-format for the given operationIds or all the operations in the spec.
   *
   * @param {string} [operationIds] - A comma separated string specifying the operations for
   * which the wire format needs to be generated. If not specified then the entire spec is
   * processed.
   */
  public processOperations(operationIds: string|null): void {
    const self = this
    if (!self.swaggerApi) {
      throw new Error(
        `Please call "specValidator.initialize()" before calling this method, ` +
        `so that swaggerApi is populated.`)
    }
    if (operationIds !== null
      && operationIds !== undefined
      && typeof operationIds.valueOf() !== "string") {
      throw new Error(`operationIds parameter must be of type 'string'.`)
    }

    let operations = self.swaggerApi.getOperations()
    if (operationIds) {
      const operationIdsObj: any = {}
      operationIds.trim().split(",").map(item => { operationIdsObj[item.trim()] = 1; })
      const operationsToValidate = operations.filter((item: any) =>
        Boolean(operationIdsObj[item.operationId]))
      if (operationsToValidate.length) { operations = operationsToValidate }
    }

    for (const operation of operations) {
      self.processOperation(operation)
    }
  }

  /*
   * Updates the validityStatus of the internal specValidationResult based on the provided value.
   *
   * @param {boolean} value A truthy or a falsy value.
   */
  private updateValidityStatus(value: boolean): void {
    if (!Boolean(value)) {
      this.specValidationResult.validityStatus = false
    } else {
      this.specValidationResult.validityStatus = true
    }
    return
  }

  /*
   * Constructs the Error object and updates the validityStatus unless indicated to not update the
   * status.
   *
   * @param {string} code The Error code that uniquely idenitifies the error.
   *
   * @param {string} message The message that provides more information about the error.
   *
   * @param {array} [innerErrors] An array of Error objects that specify inner details.
   *
   * @param {boolean} [skipValidityStatusUpdate] When specified a truthy value it will skip updating
   *                                             the validity status.
   *
   * @return {object} err Return the constructed Error object.
   */
  private constructErrorObject(
    code: any, message: string, innerErrors: any[], skipValidityStatusUpdate?: boolean
  ) {
    const err = {
      code,
      message,
      innerErrors: undefined as any
    }
    if (innerErrors) {
      err.innerErrors = innerErrors
    }
    // if (!skipValidityStatusUpdate) {
    // this.updateValidityStatus();
    // }
    return err
  }

  private async resolveExamples(): Promise<any> {
    const self = this
    const options = {
      relativeBase: self.specDir,
      filter: ["relative", "remote"]
    }

    const allRefsRemoteRelative = JsonRefs.findRefs(self.specInJson, options)
    const promiseFactories = utils.getKeys(allRefsRemoteRelative).map(refName => {
      const refDetails = allRefsRemoteRelative[refName]
      return async () => await self.resolveRelativeReference(
        refName, refDetails, self.specInJson, self.specPath)
    })
    if (promiseFactories.length) {
      return await utils.executePromisesSequentially(promiseFactories)
    } else {
      return self.specInJson
    }
  }

  private async resolveRelativeReference(
    refName: any, refDetails: any, doc: any, docPath: any
  ): Promise<any> {

    if (!refName || (refName && typeof refName.valueOf() !== "string")) {
      throw new Error('refName cannot be null or undefined and must be of type "string".')
    }

    if (!refDetails || (refDetails && !(refDetails instanceof Object))) {
      throw new Error('refDetails cannot be null or undefined and must be of type "object".')
    }

    if (!doc || (doc && !(doc instanceof Object))) {
      throw new Error('doc cannot be null or undefined and must be of type "object".')
    }

    if (!docPath || (docPath && typeof docPath.valueOf() !== "string")) {
      throw new Error('docPath cannot be null or undefined and must be of type "string".')
    }

    const node = refDetails.def
    const slicedRefName = refName.slice(1)
    const reference = node.$ref
    const parsedReference = utils.parseReferenceInSwagger(reference)
    const docDir = path.dirname(docPath)

    if (parsedReference.filePath) {
      // assuming that everything in the spec is relative to it, let us join the spec directory
      // and the file path in reference.
      docPath = utils.joinPath(docDir, parsedReference.filePath)
    }

    const result = await utils.parseJson(docPath)
    if (!parsedReference.localReference) {
      // Since there is no local reference we will replace the key in the object with the parsed
      // json (relative) file it is referring to.
      const regex = /.*x-ms-examples.*/ig
      if (slicedRefName.match(regex) !== null) {
        const exampleObj = {
          filePath: docPath,
          value: result
        }
        utils.setObject(doc, slicedRefName, exampleObj)
      }
    }
    return doc
  }

  /*
   * Generates wireformat for the given operation.
   *
   * @param {object} operation - The operation object.
   */
  private processOperation(operation: any): void {
    this.processXmsExamples(operation)
    // self.processExample(operation)
  }

  /*
   * Process the x-ms-examples object for an operation if specified in the swagger spec.
   *
   * @param {object} operation - The operation object.
   */
  private processXmsExamples(operation: any): void {
    const self = this
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }
    const xmsExamples = operation[C.xmsExamples]
    if (xmsExamples) {
      for (const scenario of utils.getKeys(xmsExamples)) {
        // If we do not see the value property then we assume that the swagger spec had
        // x-ms-examples references resolved.
        // Then we do not need to access the value property. At the same time the file name for
        // wire-format will be the sanitized scenario name.
        const xmsExample = xmsExamples[scenario].value || xmsExamples[scenario]
        const sampleRequest = self.processRequest(operation, xmsExample.parameters)
        const sampleResponses = self.processXmsExampleResponses(operation, xmsExample.responses)
        const exampleFileName = xmsExamples[scenario].filePath
          ? path.basename(xmsExamples[scenario].filePath)
          : `${utils.sanitizeFileName(scenario)}.json`
        let wireformatFileName =
          `${exampleFileName.substring(0, exampleFileName.indexOf(path.extname(exampleFileName)))}.`
        wireformatFileName += self.emitYaml ? "yml" : "md"
        const fileName = path.join(self.wireFormatDir, wireformatFileName)
        const httpTempl = self.emitYaml
          ? new YamlHttpTemplate(sampleRequest, sampleResponses)
          : new MarkdownHttpTemplate(sampleRequest, sampleResponses)
        const sampleData = httpTempl.populate()
        fs.writeFileSync(fileName, sampleData, { encoding: "utf8" })
      }
    }
  }

  /*
   * Processes the request for an operation to generate in wire format.
   *
   * @param {object} operation - The operation object.
   *
   * @param {object} exampleParameterValues - The example parameter values.
   *
   * @return {object} result - The validation result.
   */
  private processRequest(operation: any, exampleParameterValues: any): msRest.WebResource {
    const self = this
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }

    if (exampleParameterValues === null
      || exampleParameterValues === undefined
      || typeof exampleParameterValues !== "object") {
      throw new Error(
        `In operation "${operation.operationId}", exampleParameterValues cannot be null or ` +
        `undefined and must be of type "object" ` +
        `(A dictionary of key-value pairs of parameter-names and their values).`)
    }

    const parameters = operation.getParameters()
    const options: any = {}

    options.method = operation.method
    let pathTemplate = operation.pathObject.path
    if (pathTemplate && pathTemplate.includes("?")) {
      pathTemplate = pathTemplate.slice(0, pathTemplate.indexOf("?"))
      operation.pathObject.path = pathTemplate
    }
    options.pathTemplate = pathTemplate
    for (const parameter of parameters.length) {
      const location = parameter.in
      if (location === "path" || location === "query") {
        const paramType = location + "Parameters"
        if (!options[paramType]) { options[paramType] = {} }
        if (parameter[C.xmsSkipUrlEncoding]
          || utils.isUrlEncoded(exampleParameterValues[parameter.name])) {
          options[paramType][parameter.name] = {
            value: exampleParameterValues[parameter.name],
            skipUrlEncoding: true
          }
        } else {
          options[paramType][parameter.name] = exampleParameterValues[parameter.name]
        }
      } else if (location === "body") {
        options.body = exampleParameterValues[parameter.name]
        options.disableJsonStringifyOnBody = true
      } else if (location === "header") {
        if (!options.headers) { options.headers = {} }
        options.headers[parameter.name] = exampleParameterValues[parameter.name]
      }
    }

    if (options.headers) {
      if (options.headers["content-type"]) {
        const val = delete options.headers["content-type"]
        options.headers["Content-Type"] = val
      }
      if (!options.headers["Content-Type"]) {
        options.headers["Content-Type"] = utils.getJsonContentType(operation.consumes)
      }
    } else {
      options.headers = {}
      options.headers["Content-Type"] = utils.getJsonContentType(operation.consumes)
    }
    let request = null
    request = new HttpRequest()
    request = request.prepare(options)
    return request
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
  private processXmsExampleResponses(operation: any, exampleResponseValue: any) {
    const self = this
    const result: any = {}
    if (operation === null || operation === undefined || typeof operation !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }

    if (exampleResponseValue === null
      || exampleResponseValue === undefined
      || typeof exampleResponseValue !== "object") {
      throw new Error("operation cannot be null or undefined and must be of type 'object'.")
    }
    const responsesInSwagger: any = {}
    const responses = operation.getResponses().map((response: any) => {
      responsesInSwagger[response.statusCode] = response.statusCode
      return response.statusCode
    })
    if (operation["x-ms-long-running-operation"]) {
      result.longrunning = { initialResponse: undefined, finalResponse: undefined }
    } else {
      result.standard = { finalResponse: undefined }
    }

    for (const exampleResponseStatusCode of utils.getKeys(exampleResponseValue)) {
      const response = operation.getResponse(exampleResponseStatusCode)
      if (response) {
        const exampleResponseHeaders =
          exampleResponseValue[exampleResponseStatusCode].headers || {}
        const exampleResponseBody = exampleResponseValue[exampleResponseStatusCode].body
        // ensure content-type header is present
        if (!(exampleResponseHeaders["content-type"] || exampleResponseHeaders["Content-Type"])) {
          exampleResponseHeaders["content-type"] = utils.getJsonContentType(operation.produces)
        }
        const exampleResponse = new ResponseWrapper(
          exampleResponseStatusCode, exampleResponseBody, exampleResponseHeaders)
        if (operation["x-ms-long-running-operation"]) {
          if (exampleResponseStatusCode === "202" || exampleResponseStatusCode === "201") {
            result.longrunning.initialResponse = exampleResponse
          }
          if ((exampleResponseStatusCode === "200" || exampleResponseStatusCode === "204")
            && !result.longrunning.finalResponse) {
            result.longrunning.finalResponse = exampleResponse
          }
        } else {
          if (!result.standard.finalResponse) { result.standard.finalResponse = exampleResponse }
        }
      }
    }
    return result
  }

}
