// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var fs = require('fs'),
path = require('path'),
util = require('util'),
swt = require('swagger-tools').specs.v2,
RefParser = require('json-schema-ref-parser'),
utils = require('./utils'),
cwd = process.cwd();

const xmsExamples = 'x-ms-examples';
const constraints = ['minLength', 'maxLength', 'minimum', 'maximum', 'enum', 
  'maxItems', 'minItems', 'uniqueItems', 'multipleOf', 'pattern'];

class SpecValidator {

  constructor(filePath) {
    this.filePath = filePath;
    this.specInJson = null;
    this.refSpecInJson = null;
    this.specValidationResult = {};
  }

  unifyXmsPaths() {
    //unify x-ms-paths into paths
    if (this.specInJson['x-ms-paths'] && this.specInJson['x-ms-paths'] instanceof Object &&
      Object.keys(this.specInJson['x-ms-paths']).length > 0) {
      let paths = this.specInJson.paths;
      for (let property in this.specInJson['x-ms-paths']) {
        paths[property] = this.specInJson['x-ms-paths'][property];
      }
      this.specInJson.paths = paths;
    }
  }

  resolveFileReferencesInXmsExamples() {
    //Resolve all the file references for scenarios in x-ms-examples. This needs to be done before the spec is provided as an input to 
    //swagger-tools' validateModel().
    this.specValidationResult.operations = {};
    for (let apiPath in this.specInJson.paths) {
      for (let verb in this.specInJson.paths[apiPath]) {
        let operationId = this.specInJson.paths[apiPath][verb]['operationId'];
        this.specValidationResult.operations[operationId] = {};
        this.specValidationResult.operations[operationId][xmsExamples] = {};
        if (this.specInJson.paths[apiPath][verb][xmsExamples]) {
          //populate all the scenarios for the examples inline.
          this.specValidationResult.operations[operationId][xmsExamples]['scenarios'] = {};
          for (let scenarioName in this.specInJson.paths[apiPath][verb][xmsExamples]) {
            this.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName] = {};
            if (!this.specInJson.paths[apiPath][verb][xmsExamples][scenarioName]["$ref"]) {
              let msg = `$ref not found in ${this.specInJson.paths[apiPath][verb][xmsExamples][scenarioName]}`;
              let e = new Error(msg);
              e.code = 'REF_NOTFOUND_ERROR';
              this.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName]['populateScenariosInline'] = {};
              this.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName]['populateScenariosInline'].error = e;
              console.log(`${e.code} - ${e.message}`);
              continue;
            }
            //derefence the scenarioName
            let scenarioPath = path.resolve(path.dirname(this.filePath), this.specInJson.paths[apiPath][verb][xmsExamples][scenarioName]["$ref"]);
            let scenarioData;
            try {
              scenarioData = utils.parseJSONSync(scenarioPath);
            } catch (parsingError) {
              let msg = `Error occured while parsing example data from "${scenarioPath}".`;
              let e = new Error(msg);
              e.code = 'JSON_PARSING_ERROR';
              this.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName]['populateScenariosInline'] = {};
              this.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName]['populateScenariosInline'].error = e;
              console.log(`${e.code} - ${e.message}`);
              continue;
            }
            //assign the parsed example data to the scenarioName in the spec, so everything is inline.
            this.specInJson.paths[apiPath][verb][xmsExamples][scenarioName] = scenarioData;
          }
        } else {
          let msg = `Operation - "${this.specInJson.paths[apiPath][verb].operationId}", does not contain the extension: "x-ms-examples".'`;
          let e = new Error(msg);
          e.code = 'EXAMPLE_NOTFOUND_ERROR';
          this.specValidationResult.operations[operationId][xmsExamples].error = e;
          console.log(`${e.code} - ${e.message}`);
        }
      }
    }
  }

  initialize(callback) {
    let self = this;
    try {
      self.specInJson = utils.parseJSONSync(self.filePath);
    } catch (err) {
      let msg = `Error occured while parsing the spec ${self.filePath}. \t${err.message}.`;
      err.message = msg;
      err.code = 'JSON_PARSING_ERROR';
      self.specValidationResult.parseJsonSpec = {};
      self.specValidationResult.parseJsonSpec.error = err;
      console.log(`${err.code} - ${err.message}`);
      return callback(err);
    }
    self.unifyXmsPaths();
    self.resolveFileReferencesInXmsExamples();
    process.chdir(path.dirname(self.filePath));
    RefParser.resolve(self.specInJson, function (err, result) {
      process.chdir(cwd);
      if (err) {
        let msg = `Error occurred in resolving the spec "${selg.filePath}". \t${err.message}.`;
        err.code = 'RESOLVE_SPEC_ERROR';
        err.message = msg;
        self.specValidationResult.resolveSpec = {};
        self.specValidationResult.resolveSpec.error = err;
        console.log(`${err.code} - ${err.message}`);
        return callback(err);
      }
      self.refSpecInJson = result;
      return callback(null);
    });
  }

  //wrapper to validateModel of swagger-tools
  validateModel(modelReference, data) {
    let self = this;
    if (!modelReference) {
      throw new Error('modelReference cannot be null or undefined. It must be of a string. Example: "#/definitions/foo".');
    }
    if (!data) {
      throw new Error('data cannot be null or undefined. It must be of a JSON object or a JSON array.');
    }

    return function (callback) {
      swt.validateModel(self.specInJson, modelReference, data, callback);
    }
  }

  validateDateTypes(schema, value) {
    if (value !== null && value !== undefined) {
      if (schema.format.match(/^date$/ig) !== null) {
        if (!(value instanceof Date ||
          (typeof value.valueOf() === 'string' && !isNaN(Date.parse(value))))) {
          throw new Error(util.format('%s must be an instanceof Date or a string in ISO8601 format.', schema.name));
        }
      } else if (schema.format.match(/^date-time$/ig) !== null) {
        if (!(value instanceof Date ||
          (typeof value.valueOf() === 'string' && !isNaN(Date.parse(value))))) {
          throw new Error(util.format('%s must be an instanceof Date or a string in ISO8601 format.', schema.name));
        }
      } else if (schema.format.match(/^date-time-rfc-1123$/ig) !== null) {
        if (!(value instanceof Date ||
          (typeof value.valueOf() === 'string' && !isNaN(Date.parse(value))))) {
          throw new Error(util.format('%s must be an instanceof Date or a string in RFC-1123 format.', schema.name));
        }
      } else if (schema.format.match(/^unixtime$/ig) !== null) {
        if (!(value instanceof Date ||
          (typeof value.valueOf() === 'string' && !isNaN(Date.parse(value))))) {
          throw new Error(util.format('%s must be an instanceof Date or a string in RFC-1123/ISO8601 format ' +
            'for it to be serialized in UnixTime/Epoch format.', schema.name));
        }
      } else if (schema.format.match(/^(duration|timespan)$/ig) !== null) {
        if (!moment.isDuration(value)) {
          throw new Error(util.format('%s must be a TimeSpan/Duration.', schema.name));
        }
      }
    }
  }

  validateBufferType(schema, value) {
    if (value !== null && value !== undefined) {
      if (!Buffer.isBuffer(value)) {
        throw new Error(util.format('%s must be of type Buffer.', schema.name));
      }
    }
  }

  isValidUuid(uuid) {
    let validUuidRegex = new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', 'ig');
    return validUuidRegex.test(uuid);
  };

  validateBasicTypes(schema, value) {
    if (value !== null && value !== undefined) {
      if (schema.type.match(/^(number|integer)$/ig) !== null) {
        if (typeof value !== 'number') {
          throw new Error(util.format('%s with value %s must be of type number.', schema.name, value));
        }
      } else if (schema.type.match(/^string$/ig) !== null) {
        if (typeof value.valueOf() !== 'string') {
          throw new Error(util.format('%s with value \'%s\' must be of type string.', schema.name, value));
        }
        if (schema.format && schema.format.match(/^uuid$/ig) !== null) {
          if (!(typeof value.valueOf() === 'string' && this.isValidUuid(value))) {
            throw new Error(util.format('%s with value \'%s\' must be of type string and a valid uuid.', schema.name, value));
          }
        }
      } else if (schema.type.match(/^boolean$/ig) !== null) {
        if (typeof value !== 'boolean') {
          throw new Error(util.format('%s with value %s must be of type boolean.', schema.name, value));
        }
      }
    }
  }

  //entry point for type validations
  validateType(schema, data) {
    if (schema.type.match(/^(number|string|boolean|integer)$/ig) !== null) {
      if (schema.format) {
        if (schema.format.match(/^(date|date-time|timespan|duration|date-time-rfc1123|unixtime)$/ig) !== null) {
          this.validateDateTypes(schema, data);
        } else if (schema.format.match(/^b(yte|ase64url)$/ig) !== null) {
          this.validateBufferType(schema, data);
        }
      } else {
        this.validateBasicTypes(schema, data);
      }
    } else {
      throw new Error(util.format('Unknown type: "%s" provided for parameter: "%s"', schema.type, schema.name));
    }
  };

  //validates constraints
  validateConstraints(schema, value, objectName) {
    let constraintErrors = [];
    constraints.forEach(function (constraintType) {
      if (schema[constraintType] !== null && schema[constraintType] !== undefined) {
        if (constraintType.match(/^maximum$/ig) !== null) {
          if (schema['exclusiveMaximum']) {
            if (value >= schema[constraintType]) {
              let e = new Error(util.format('\'%s\' with value \'%s\' should satify the constraint ' + 
                '\'exclusiveMaximum\': true and \'maximum\': %s', objectName, value, schema[constraintType]));
              e.code = 'EXCLUSIVE_MAXIMUM_FAILURE';
              constraintErrors.push(e);
            }
          } else {
            if (value > schema[constraintType]) {
              let e = new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'maximum\': %s', 
              objectName, value, schema[constraintType]));
              e.code = 'MAXIMUM_FAILURE';
              constraintErrors.push(e);
            }
          }
        } else if (constraintType.match(/^minimum$/ig) !== null) {
          if (schema['exclusiveMinimum']) {
            if (value <= schema[constraintType]) {
              let e =  new Error(util.format('\'%s\' with value \'%s\' should satify the constraint ' + 
                '\'exclusiveMinimum\': true and \'minimum\': %s',
              objectName, value, schema[constraintType]));
              e.code = 'EXCLUSIVE_MINIMUM_FAILURE';
              constraintErrors.push(e);
            }
          } else {
            if (value < schema[constraintType]) {
              let e = new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'minimum\': %s', 
              objectName, value, schema[constraintType]));
              e.code = 'MINIMUM_FAILURE';
              constraintErrors.push(e);
            }
          } 
        } else if (constraintType.match(/^maxItems$/ig) !== null) {
          if (value.length > schema[constraintType]) {
            let e = new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'maxItems\': %s', 
            objectName, value, schema[constraintType]));
            e.code = 'MAXITEMS_FAILURE';
            constraintErrors.push(e);
          }
        } else if (constraintType.match(/^maxLength$/ig) !== null) {
          if (value.length > schema[constraintType]) {
            let e = new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'maxLength\': %s', 
            objectName, value, schema[constraintType]));
            e.code = 'MAXLENGTH_FAILURE';
            constraintErrors.push(e);
          }
        } else if (constraintType.match(/^minItems$/ig) !== null) {
          if (value.length < schema[constraintType]) {
            let e = new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'minItems\': %s', 
            objectName, value, schema[constraintType]));
            e.code = 'MINITEMS_FAILURE';
            constraintErrors.push(e);
          }
        } else if (constraintType.match(/^minLength$/ig) !== null) {
          if (value.length < schema[constraintType]) {
            throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'minLength\': %s', 
            objectName, value, schema[constraintType]));
            e.code = 'MINLENGTH_FAILURE';
            constraintErrors.push(e);
          }
        } else if (constraintType.match(/^multipleOf$/ig) !== null) {
          if (value.length % schema[constraintType] !== 0) {
            let e = new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'multipleOf\': %s', 
            objectName, value, schema[constraintType]));
            e.code = 'MULTIPLEOF_FAILURE';
            constraintErrors.push(e);
          }
        } else if (constraintType.match(/^pattern$/ig) !== null) {
          if (value.match(schema[constraintType].split('/').join('\/')) === null) {
            let e = new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'pattern\': %s', 
            objectName, value, schema[constraintType]));
            e.code = 'REGEX_PATTERN_FAILURE';
            constraintErrors.push(e);
          }
        } else if (constraintType.match(/^uniqueItems/ig) !== null) {
          if (schema[constraintType]) {
            if (value.length !== value.filter(function (item, i, ar) { { return ar.indexOf(item) === i; } }).length) {
              let e = new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'uniqueItems\': %s', 
              objectName, value, schema[constraintType]));
              e.code = 'UNIQUEITEMS_FAILURE';
              constraintErrors.push(e);
            }
          }
        } else if (constraintType.match(/^enum/ig) !== null) {
          let isPresent = schema[constraintType].some(function (item) {
            return item === value;
          });
          if (!isPresent && schema['x-ms-enum'] && !Boolean(schema['x-ms-enum']['modelAsString'])) {
            let e = new Error(util.format('%s is not a valid value for %s. The valid values are: %s', 
              value, objectName, JSON.stringify(schema[constraintType])));
            e.code = 'ENUM_FAILURE';
            constraintErrors.push(e);
          }
        }
      }
    });
    if (constraintErrors.length > 0) {
      return constraintErrors;
    }
  }

  validateNonBodyParameter(schema, data, operationId, scenarioName) {
    let result = {
      validationErrors: null,
      typeError: null
    };
    //constraint validation
    result.validationErrors = this.validateConstraints(schema, data, schema.name);
    //type validation
    try {
      this.validateType(schema, data);
    } catch (typeError) {
      result.typeError = `${typeError.message} in operation: "${operationId}".`;
    }
    return result;
  }

  validateDataModels(callback) {
    let self = this;
    this.initialize(function(initializationErr, result) {
      if (initializationErr) {
        return callback(initializationErr);
      }
      utils.run(function* () {
        let apiPaths = Object.keys(self.specInJson.paths);
        for (let i = 0; i < apiPaths.length; i++) {
          let verbs = Object.keys(self.specInJson.paths[apiPaths[i]]);
          for (let j = 0; j < verbs.length; j++) {
            if (self.specInJson.paths[apiPaths[i]][verbs[j]][xmsExamples]) {
              let scenarios = Object.keys(self.specInJson.paths[apiPaths[i]][verbs[j]][xmsExamples]);
              for (let k = 0; k < scenarios.length; k++) {
                let apiPath = apiPaths[i], verb = verbs[j], scenarioName = scenarios[k];
                let operation = self.specInJson.paths[apiPath][verb];
                let operationId = operation.operationId;
                let scenarioData = operation[xmsExamples][scenarioName];
                //validate parameters
                self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters = {};
                for (let l = 0; l < operation.parameters.length; l++) {
                  let parameter = operation.parameters[l];
                  let dereferencedParameter = parameter;
                  if (parameter['$ref']) {
                    dereferencedParameter = self.refSpecInJson.get(parameter['$ref']);
                  }
                  let parameterName = dereferencedParameter.name;
                  self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName] = {};
                  self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = true;
                  //check for requiredness
                  if (dereferencedParameter.required && !scenarioData.parameters[parameterName]) {
                    let msg = `Swagger spec has a parameter named "${dereferencedParameter.name}" as required for operation "${operationId}", ` + 
                      `however this parameter is not defined in the example for scenario "${scenarioName}".`;
                    self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = false;
                    let reqError = new Error(msg);
                    reqError.code = 'REQUIRED_PARAMETER_NOT_IN_EXAMPLE_ERROR';
                    self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName].error = reqError;
                    console.error(msg);
                    continue;
                  }
                  if (dereferencedParameter.in === 'body') {
                    let modelReference = dereferencedParameter.schema['$ref'];
                    try {
                      let result = yield self.validateModel(modelReference, scenarioData.parameters[parameterName]);
                      if (result) {
                        self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = false;
                        let msg = `Found errors in validating the body parameter for example "${scenarioName}" in operation "${operationId}".`;
                        let bodyValidationError = new Error(msg);
                        bodyValidationError.code = 'BODY_PARAMETER_VALIDATION_ERROR';
                        bodyValidationError.innerErrors = result.errors;
                        self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName].error = bodyValidationError;
                        console.error(`"${bodyValidationError.code}" - ${msg}`);
                      } else {
                        let msg = `The body parameter for example "${scenarioName}" in operation "${operationId}" is valid.`;
                        self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['result'] = msg;
                        console.log(msg);
                      }
                    } catch(err) {
                      self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = false;
                      err.code = 'INTERNAL_ERROR' + (err.code ? ' ' + err.code : '');
                      self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName].error = err;
                    }
                  } else {
                    let errors = self.validateNonBodyParameter(dereferencedParameter, scenarioData.parameters[parameterName], operationId, scenarioName);
                    let nonBodyError;
                    if (errors.validationErrors) {
                      self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = false;
                      let msg = `${parameterName} in operation ${operationId} failed validation constraints.`;
                      nonBodyError = new Error(msg);
                      nonBodyError.code = 'CONSTRAINT_VALIDATION_ERROR';
                      nonBodyError.innerErrors = errors.validationErrors;
                      self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName].error = nonBodyError;
                      console.log(`${msg}`);
                    }
                    if (errors.typeError) {
                      self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = false;
                      errors.typeError.code = 'TYPE_VALIDATION_ERROR';
                      if (errors.validationErrors) {
                        nonBodyError.code += ' + ' + errors.typeError.code
                        nonBodyError.innerErrors.push(errors.typeError);
                        self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName].error = nonBodyError;
                      } else {
                        self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName].error = errors.typeError;
                      }
                      console.log(`${errors.typeError.code} - ${errors.typeError.message}`);
                    }
                  }
                }

                //validate responses
                self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses = {};
                let res = Object.keys(operation.responses);
                for (let m = 0; m < res.length; m++) {
                  let statusCode = res[m];
                  self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode] = {};
                  self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['isValid'] = true;
                  if (!scenarioData.responses[statusCode]) {
                    let msg = `Response with statusCode "${statusCode}" for operation "${operationId}" is present in the spec, but not in the example "${scenarioName}".`;
                    let e = new Error(msg);
                    e.code = 'STATUS_CODE_NOT_IN_EXAMPLE_ERROR';
                    self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['isValid'] = false;
                    self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode].error = e;
                    continue;
                  }
                  //Currently only validating $ref in responses. What if it is an inline schema? Will have to add the logic to 
                  //add the schema in the definitions section and replace the inline schema with a ref corresponding to that definition.
                  if (operation.responses[statusCode]['schema'] && operation.responses[statusCode]['schema']['$ref']) {
                    let modelReference = operation.responses[statusCode]['schema']['$ref'];
                    try {
                      let result = yield self.validateModel(modelReference, scenarioData.responses[statusCode].body);
                      if (result) {
                        let msg = `Found errors in validating the response with statusCode "${statusCode}" for ` + 
                        `example "${scenarioName}" in operation "${operationId}".`;
                        let responseBodyValidationError = new Error(msg);
                        responseBodyValidationError.code = 'RESPONSE_BODY_VALIDATION_ERROR';
                        responseBodyValidationError.innerErrors = result.errors;
                        self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['isValid'] = false;
                        self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode].error = responseBodyValidationError;
                        console.log(`${responseBodyValidationError.code} - ${msg}`);
                      } else {
                        let msg = `Response with statusCode "${statusCode}" for example "${scenarioName}" in operation "${operationId}" is valid.`
                        self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['result'] = msg;
                        console.log(msg);
                      }
                    } catch(err) {
                      self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['isValid'] = false;
                      err.code = 'INTERNAL_ERROR' + (err.code ? ' ' + err.code : '');
                      self.specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode].error = err;
                    }
                  }
                }
              }
            }
          }
        }
        return callback(null);
      });
    });
  }
}

module.exports = SpecValidator;