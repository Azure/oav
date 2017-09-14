// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

const JsonRefs = require('json-refs');
const fs = require('fs');
const path = require('path');
const utils = require('./util/utils');
const Sway = require('sway');
const msRest = require('ms-rest');
const HttpRequest = msRest.WebResource;
const log = require('./util/logging');
const SpecResolver = require('./validators/specResolver');
const ResponseWrapper = require('./models/responseWrapper');
const MarkdownHttpTemplate = require('./templates/markdownHttpTemplate');
const YamlHttpTemplate = require('./templates/yamlHttpTemplate');
const Constants = require('./util/constants');
const ErrorCodes = Constants.ErrorCodes;


class WireFormatGenerator {
  constructor(specPath, specInJson, wireFormatDir, emitYaml) {
    if (specPath === null || specPath === undefined || typeof specPath.valueOf() !== 'string' || !specPath.trim().length) {
      throw new Error('specPath is a required parameter of type string and it cannot be an empty string.')
    }
    //If the spec path is a url starting with https://github then let us auto convert it to an https://raw.githubusercontent url.
    if (specPath.startsWith('https://github')) {
      specPath = specPath.replace(/^https:\/\/(github.com)(.*)blob\/(.*)/ig, 'https://raw.githubusercontent.com$2$3');
    }
    this.specPath = specPath;
    this.specDir = path.dirname(this.specPath);
    let wfDir = path.join(this.specDir, 'wire-format');
    if (specPath.startsWith('https://')) {
      wfDir = process.cwd() + '/wire-format';
    }
    this.wireFormatDir = wireFormatDir || wfDir;
    if (!fs.existsSync(this.wireFormatDir)) {
      fs.mkdirSync(this.wireFormatDir);
    }
    this.emitYaml = emitYaml || false;
    this.specInJson = specInJson;
    this.specResolver = null;
    this.swaggerApi = null;
    this.options = {
      shouldResolveRelativePaths: true
    }
  }

  initialize() {
    let self = this;
    if (self.options.shouldResolveRelativePaths) {
      utils.clearCache();
    }
    return utils.parseJson(self.specPath).then((result) => {
      self.specInJson = result;
      let options = {
        shouldResolveRelativePaths: true,
        shouldResolveXmsExamples: false,
        shouldResolveAllOf: false,
        shouldSetAdditionalPropertiesFalse: false,
        shouldResolvePureObjects: false
      }
      self.specResolver = new SpecResolver(self.specPath, self.specInJson, options);
      return self.specResolver.resolve();
    }).then(() => {
      return self.resolveExamples();
    }).then(() => {
      let options = {};
      options.definition = self.specInJson;
      options.jsonRefs = {};
      options.jsonRefs.relativeBase = self.specDir;
      return Sway.create(options);
    }).then((api) => {
      self.swaggerApi = api;
      return Promise.resolve(api);
    }).catch((err) => {
      let e = self.constructErrorObject(ErrorCodes.ResolveSpecError, err.message, [err]);
      //self.specValidationResult.resolveSpec = e;
      log.error(`${ErrorCodes.ResolveSpecError.name}: ${err.message}.`);
      log.error(err.stack);
      return Promise.reject(e);
    });
  }

  /*
   * Updates the validityStatus of the internal specValidationResult based on the provided value.
   * 
   * @param {boolean} value A truthy or a falsy value.
   */
  updateValidityStatus(value) {
    if (!Boolean(value)) {
      this.specValidationResult.validityStatus = false;
    } else {
      this.specValidationResult.validityStatus = true;
    }
    return;
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
  constructErrorObject(code, message, innerErrors, skipValidityStatusUpdate) {
    let err = {
      code: code,
      message: message,
    }
    if (innerErrors) {
      err.innerErrors = innerErrors;
    }
    if (!skipValidityStatusUpdate) {
      //this.updateValidityStatus();
    }
    return err;
  }

  resolveExamples() {
    let self = this;
    let options = {
      relativeBase: self.specDir,
      filter: ['relative', 'remote']
    };

    let allRefsRemoteRelative = JsonRefs.findRefs(self.specInJson, options);
    let promiseFactories = Object.keys(allRefsRemoteRelative).map(function (refName) {
      let refDetails = allRefsRemoteRelative[refName];
      return function () { return self.resolveRelativeReference(refName, refDetails, self.specInJson, self.specPath); };
    });
    if (promiseFactories.length) {
      return utils.executePromisesSequentially(promiseFactories);
    } else {
      return Promise.resolve(self.specInJson);
    }
  }

  resolveRelativeReference(refName, refDetails, doc, docPath) {
    if (!refName || (refName && typeof refName.valueOf() !== 'string')) {
      throw new Error('refName cannot be null or undefined and must be of type "string".');
    }

    if (!refDetails || (refDetails && !(refDetails instanceof Object))) {
      throw new Error('refDetails cannot be null or undefined and must be of type "object".');
    }

    if (!doc || (doc && !(doc instanceof Object))) {
      throw new Error('doc cannot be null or undefined and must be of type "object".');
    }

    if (!docPath || (docPath && typeof docPath.valueOf() !== 'string')) {
      throw new Error('docPath cannot be null or undefined and must be of type "string".');
    }

    let self = this;
    let node = refDetails.def;
    let slicedRefName = refName.slice(1);
    let reference = node['$ref'];
    let parsedReference = utils.parseReferenceInSwagger(reference);
    let docDir = path.dirname(docPath);

    if (parsedReference.filePath) {
      //assuming that everything in the spec is relative to it, let us join the spec directory 
      //and the file path in reference.
      docPath = utils.joinPath(docDir, parsedReference.filePath);
    }

    return utils.parseJson(docPath).then((result) => {
      if (!parsedReference.localReference) {
        //Since there is no local reference we will replace the key in the object with the parsed 
        //json (relative) file it is refering to.
        let regex = /.*x-ms-examples.*/ig;
        if (slicedRefName.match(regex) !== null) {
          let exampleObj = {
            filePath: docPath,
            value: result
          };
          utils.setObject(doc, slicedRefName, exampleObj);
        }
      }
      return Promise.resolve(doc);
    });
  }

  /*
   * Generates wireformat for the given operationIds or all the operations in the spec.
   * 
   * @param {string} [operationIds] - A comma sparated string specifying the operations for 
   * which the wire format needs to be generated. If not specified then the entire spec is processed.
   */
  processOperations(operationIds) {
    let self = this;
    if (!self.swaggerApi) {
      throw new Error(`Please call "specValidator.initialize()" before calling this method, so that swaggerApi is populated.`);
    }
    if (operationIds !== null && operationIds !== undefined && typeof operationIds.valueOf() !== 'string') {
      throw new Error(`operationIds parameter must be of type 'string'.`);
    }

    let operations = self.swaggerApi.getOperations();
    if (operationIds) {
      let operationIdsObj = {};
      operationIds.trim().split(',').map(function (item) { operationIdsObj[item.trim()] = 1; });
      let operationsToValidate = operations.filter(function (item) {
        return Boolean(operationIdsObj[item.operationId]);
      });
      if (operationsToValidate.length) operations = operationsToValidate;
    }

    for (let i = 0; i < operations.length; i++) {
      let operation = operations[i];
      self.processOperation(operation);
    }
  }

  /*
   * Generates wireformat for the given operation.
   * 
   * @param {object} operation - The operation object.
   */
  processOperation(operation) {
    let self = this;
    self.processXmsExamples(operation);
    //self.processExample(operation);
    return;
  }

  /*
   * Process the x-ms-examples object for an operation if specified in the swagger spec.
   * 
   * @param {object} operation - The operation object.
   */
  processXmsExamples(operation) {
    let self = this;
    if (operation === null || operation === undefined || typeof operation !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.');
    }
    let xmsExamples = operation[Constants.xmsExamples];
    if (xmsExamples) {
      for (let scenario in xmsExamples) {
        //If we do not see the value property then we assume that the swagger spec had x-ms-examples references resolved. 
        //Then we do not need to access the value property. At the same time the file name for wire-format will be the sanitized scenario name.
        let xmsExample = xmsExamples[scenario].value || xmsExamples[scenario];
        let sampleRequest = self.processRequest(operation, xmsExample.parameters);
        let sampleResponses = self.processXmsExampleResponses(operation, xmsExample.responses);
        let exampleFileName = xmsExamples[scenario].filePath ? path.basename(xmsExamples[scenario].filePath) : `${utils.sanitizeFileName(scenario)}.json`;
        let wireformatFileName = `${exampleFileName.substring(0, exampleFileName.indexOf(path.extname(exampleFileName)))}.`;
        wireformatFileName += self.emitYaml ? 'yml' : 'md';
        let fileName = path.join(self.wireFormatDir, wireformatFileName);
        let httpTempl = self.emitYaml ? new YamlHttpTemplate(sampleRequest, sampleResponses) : new MarkdownHttpTemplate(sampleRequest, sampleResponses);
        let sampleData = httpTempl.populate();
        fs.writeFileSync(fileName, sampleData, { encoding: 'utf8' });
      }
    }
    return;
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
  processRequest(operation, exampleParameterValues) {
    let self = this;
    if (operation === null || operation === undefined || typeof operation !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.');
    }

    if (exampleParameterValues === null || exampleParameterValues === undefined || typeof exampleParameterValues !== 'object') {
      throw new Error(`In operation "${operation.operationId}", exampleParameterValues cannot be null or undefined and ` +
        `must be of type "object" (A dictionary of key-value pairs of parameter-names and their values).`);
    }

    let parameters = operation.getParameters();
    let options = {};

    options.method = operation.method;
    let pathTemplate = operation.pathObject.path;
    if (pathTemplate && pathTemplate.includes("?")) {
      pathTemplate = pathTemplate.slice(0, pathTemplate.indexOf("?"));
      operation.pathObject.path = pathTemplate;
    }
    options.pathTemplate = pathTemplate;
    for (let i = 0; i < parameters.length; i++) {
      let parameter = parameters[i];
      let location = parameter.in;
      if (location === 'path' || location === 'query') {
        let paramType = location + 'Parameters';
        if (!options[paramType]) options[paramType] = {};
        if (parameter[Constants.xmsSkipUrlEncoding] || utils.isUrlEncoded(exampleParameterValues[parameter.name])) {
          options[paramType][parameter.name] = {
            value: exampleParameterValues[parameter.name],
            skipUrlEncoding: true
          };
        } else {
          options[paramType][parameter.name] = exampleParameterValues[parameter.name];
        }
      } else if (location === 'body') {
        options.body = exampleParameterValues[parameter.name];
        options.disableJsonStringifyOnBody = true;
      } else if (location === 'header') {
        if (!options.headers) options.headers = {};
        options.headers[parameter.name] = exampleParameterValues[parameter.name];
      }
    }

    if (options.headers) {
      if (options.headers['content-type']) {
        let val = delete options.headers['content-type'];
        options.headers['Content-Type'] = val;
      }
      if (!options.headers['Content-Type']) {
        options.headers['Content-Type'] = utils.getJsonContentType(operation.consumes);
      }
    } else {
      options.headers = {};
      options.headers['Content-Type'] = utils.getJsonContentType(operation.consumes);
    }
    let request = null;
    request = new HttpRequest();
    request = request.prepare(options);
    return request;
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
  processXmsExampleResponses(operation, exampleResponseValue) {
    let self = this;
    let result = {};
    if (operation === null || operation === undefined || typeof operation !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.');
    }

    if (exampleResponseValue === null || exampleResponseValue === undefined || typeof exampleResponseValue !== 'object') {
      throw new Error('operation cannot be null or undefined and must be of type \'object\'.');
    }
    let responsesInSwagger = {};
    let responses = operation.getResponses().map(function (response) {
      responsesInSwagger[response.statusCode] = response.statusCode;
      return response.statusCode;
    });
    if (operation['x-ms-long-running-operation']) {
      result.longrunning = { initialResponse: undefined, finalResponse: undefined };
    } else {
      result.standard = { finalResponse: undefined };
    }

    for (let exampleResponseStatusCode in exampleResponseValue) {
      let response = operation.getResponse(exampleResponseStatusCode);
      if (response) {
        let exampleResponseHeaders = exampleResponseValue[exampleResponseStatusCode]['headers'] || {};
        let exampleResponseBody = exampleResponseValue[exampleResponseStatusCode]['body'];
        //ensure content-type header is present
        if (!(exampleResponseHeaders['content-type'] || exampleResponseHeaders['Content-Type'])) {
          exampleResponseHeaders['content-type'] = utils.getJsonContentType(operation.produces);
        }
        let exampleResponse = new ResponseWrapper(exampleResponseStatusCode, exampleResponseBody, exampleResponseHeaders);
        if (operation['x-ms-long-running-operation']) {
          if (exampleResponseStatusCode === '202' || exampleResponseStatusCode === '201') result.longrunning.initialResponse = exampleResponse;
          if ((exampleResponseStatusCode === '200' || exampleResponseStatusCode === '204') && !result.longrunning.finalResponse) result.longrunning.finalResponse = exampleResponse;
        } else {
          if (!result.standard.finalResponse) result.standard.finalResponse = exampleResponse;
        }
      }
    }
    return result;
  }

}

module.exports = WireFormatGenerator;