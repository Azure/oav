'use strict';

var fs = require('fs'),
glob = require('glob'),
path = require('path'),
util = require('util'),
async = require('async'),
moment = require('moment'),
spec = require('swagger-tools').specs.v2,
RefParser = require('json-schema-ref-parser');

var cwd = process.cwd();
var globPath = path.join(__dirname, '../', '/**/swagger/*.json');
var swaggers = glob.sync(globPath).filter(function(entry) {
  if (entry.match(/.*arm-storage\/2016-01-01\/swagger.*/ig) !== null) {
    return entry;
  }
});
var count = 0;
const xmsExamples = 'x-ms-examples';
//parsed swagger spec in json format
var specInJson = {},
//output of the RefParser that helps us in getting objects using json pointer ("$ref")
refSpecInJson = {},
//the uber result object that provides the status of all the swagger specs that were processed by the dataValidator
finalValidationResult = {},
//the result object that stores the validationResult of a spec.
specValidationResult = {};

//list of constraints understood by swagger 2.0 specification
var constraints = [ 'minLength', 'maxLength', 'minimum', 'maximum', 'enum', 
  'maxItems', 'minItems', 'uniqueItems', 'multipleOf', 'pattern'];

//Entrypoint of the grunt work.
swaggers.forEach(function(spec){
  //parse the spec into a JSON object
  finalValidationResult[spec] = specValidationResult;
  try {
    specInJson = parseJSONSync(spec);
  } catch (err) {
    var msg = `Error occured while parsing the spec ${spec} - \n ${util.inspect(err, {depth: null})}.`;
    specValidationResult.parsedJson = {};
    finalValidationResult[spec].parsedJson.error = msg;
    return;
  }

  //unify x-ms-paths into paths
  if (specInJson['x-ms-paths'] && specInJson['x-ms-paths'] instanceof Object && 
    Object.keys(specInJson['x-ms-paths']).length > 0) {
    var paths = specInJson.paths;
    for (var property in specInJson['x-ms-paths']) {
      paths[property] = specInJson['x-ms-paths'][property];
    }
    specInJson.paths = paths;
  }
  specValidationResult.operations = {};
  //Resolve all the file references for scenarios in x-ms-examples. This needs to be done before the spec is provided as an input to 
  //swagger-tools' validateModel().
  for (var apiPath in specInJson.paths) {
    for (var verb in specInJson.paths[apiPath]) {
      var operationId = specInJson.paths[apiPath][verb]['operationId'];
      specValidationResult.operations[operationId] = {};
      specValidationResult.operations[operationId][xmsExamples] = {};
      if (specInJson.paths[apiPath][verb][xmsExamples]) {
        //populate all the scenarios for the examples inline.
        specValidationResult.operations[operationId][xmsExamples]['scenarios'] = {};
        for (var scenarioName in specInJson.paths[apiPath][verb][xmsExamples]) {
          specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName] = {};
          if (!specInJson.paths[apiPath][verb][xmsExamples][scenarioName]["$ref"]) {
            var msg = `$ref not found in ${specInJson.paths[apiPath][verb][xmsExamples][scenarioName]}`;
            specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName]['populateScenariosInline'] = {};
            specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName]['populateScenariosInline']['REF_NOTFOUND_ERROR'] = msg;
            continue;
          }
          //derefence the scenarioName
          var scenarioPath = path.resolve(path.dirname(spec), specInJson.paths[apiPath][verb][xmsExamples][scenarioName]["$ref"]);
          var scenarioData;
          try {
            scenarioData = parseJSONSync(scenarioPath);
          } catch (parsingError) {
            var msg = `Error occured while parsing example data from "${scenarioPath}" - \n${util.inspect(parsingError, {depth: null})}.`;
            specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName]['populateScenariosInline']['JSON_PARSING_ERROR'] = msg;
            continue;
          }
          //assign the parsed example data to the scenarioName in the spec, so everything is inline.
          specInJson.paths[apiPath][verb][xmsExamples][scenarioName] = scenarioData;
        }
      } else {
        var msg = `Operation - "${specInJson.paths[apiPath][verb].operationId}", does not contain the extension: "x-ms-examples".'`;
        specValidationResult.operations[operationId][xmsExamples]['EXAMPLE_NOTFOUND_ERROR']= msg;
      }
    }
  }

  async.series([
    //Get the resolved spec in json (output of the RefParser).
    function(callback) {
      process.chdir(path.dirname(spec));
      RefParser.resolve(specInJson, function(err, result) {
        process.chdir(cwd);
        if (err) {
          var msg = `Error occurred in resolving the spec "${spec}". Details of the error are:\n${util.format(err, {depth: null})}.`;
          sspecValidationResult.resolveSpec = {};
          specValidationResult.resolveSpec['RESOLVE_SPEC_ERROR'] = msg;
          return callback(new Error(msg));
        }
        refSpecInJson = result;
        return callback(null, refSpecInJson);
      });
    },
    //Validate every scenario provided in every x-ms-examples extension for every operation.
    function(callback) {
      run (function* () {
        var apiPaths = Object.keys(specInJson.paths);
        for (var i = 0; i < apiPaths.length; i++) {
          var verbs = Object.keys(specInJson.paths[apiPaths[i]]);
          for (var j = 0; j < verbs.length; j++) {
            if (specInJson.paths[apiPaths[i]][verbs[j]][xmsExamples]) {
              var scenarios = Object.keys(specInJson.paths[apiPaths[i]][verbs[j]][xmsExamples]);
              for (var k = 0; k < scenarios.length; k++) {
                //validateScenario(apiPaths[i], verbs[j], scenarios[k]);
                var apiPath = apiPaths[i], verb = verbs[j], scenarioName = scenarios[k];
                var operation = specInJson.paths[apiPath][verb];
                var operationId = operation.operationId;
                var scenarioData = operation[xmsExamples][scenarioName];
                var validationResult = [];
                //validate parameters
                specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters = {};
                for (var l = 0; l < operation.parameters.length; l++) {
                  var parameter = operation.parameters[l];
                  var dereferencedParameter = parameter;
                  if (parameter['$ref']) {
                    dereferencedParameter = refSpecInJson.get(parameter['$ref']);
                  }
                  var parameterName = dereferencedParameter.name;
                  specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName] = {};
                  specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = true;
                  //check for requiredness
                  if (dereferencedParameter.required && !scenarioData.parameters[parameterName]) {
                    var msg = `Swagger spec has a parameter named "${dereferencedParameter.name}" as required for operation "${operationId}", ` + 
                      `however this parameter is not defined in the example for scenario "${scenarioName}".`;
                    specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = false;
                    specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['REQUIRED_PARAMETER_NOT_IN_EXAMPLE_ERROR'] = msg;
                    console.error(msg);
                    continue;
                  }
                  if (dereferencedParameter.in === 'body') {
                    var modelReference = dereferencedParameter.schema['$ref'];
                    try {
                      var result = yield validateModel(modelReference, scenarioData.parameters[parameterName]);
                      if (result) {
                        specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = false;
                        var msg = `Found errors in validating the body parameter for example "${scenarioName}" in operation "${operationId}".\n
                        ${util.inspect(result, {depth: null})}`;
                        specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['BODY_PARAMETER_VALIDATION_ERROR'] = msg;
                        console.log(msg);
                      } else {
                        var msg = `The body parameter for example "${scenarioName}" in operation "${operationId}" is valid.`;
                        specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['result'] = msg;
                        console.log(msg);
                      }
                    } catch(err) {
                      specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = false;
                      specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['INTERNAL_ERROR'] = util.inspect(err, {depth: null});
                    }
                  } else {
                    var errors = validateNonBodyParameter(dereferencedParameter, scenarioData.parameters[parameterName], operationId, scenarioName);
                    if (errors.validationError) {
                      specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = false;
                      specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['CONSTRAINT_VALIDATION_ERROR'] = errors.validationError;
                      console.log(errors.validationError);
                    }
                    if (errors.typeError) {
                      specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['isValid'] = false;
                      specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].parameters[parameterName]['TYPE_VALIDATION_ERROR'] = errors.typeError;
                      console.log(errors.typeError);
                    }
                    validationResult.push(errors);
                  }
                }

                //validate responses
                specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses = {};
                var res = Object.keys(operation.responses);
                for (var m = 0; m < res.length; m++) {
                  var statusCode = res[m];
                  specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode] = {};
                  specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['isValid'] = true;
                  if (!scenarioData.responses[statusCode]) {
                    var msg = `Response with statusCode "${statusCode}" for operation "${operationId}" is present in the spec, but not in the example "${scenarioName}".`;
                    specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['isValid'] = false;
                    specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['STATUS_CODE_NOT_IN_EXAMPLE_ERROR'] = msg;
                    return callback(new Error(msg));
                  }
                  //Currently only validating $ref in responses. What if it is an inline schema? Will have to add the logic to 
                  //add the schema in the definitions section and replace the inline schema with a ref corresponding to that definition.
                  if (operation.responses[statusCode]['schema'] && operation.responses[statusCode]['schema']['$ref']) {
                    var modelReference = operation.responses[statusCode]['schema']['$ref'];
                    try {
                      var result = yield validateModel(modelReference, scenarioData.responses[statusCode].body);
                      if (result) {
                        var msg = `Found errors in validating the response with statusCode "${statusCode}" for ` + 
                        `example "${scenarioName}" in operation "${operationId}".\n${util.inspect(result, {depth: null})}.`;
                        specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['isValid'] = false;
                        specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['RESPONSE_BODY_VALIDATION_ERROR'] = msg;
                        console.log(msg);
                      } else {
                        var msg = `Response with statusCode "${statusCode}" for example "${scenarioName}" in operation "${operationId}" is valid.`
                        specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['result'] = msg;
                        console.log(msg);
                      }
                    } catch(err) {
                      specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['isValid'] = false;
                      specValidationResult.operations[operationId][xmsExamples]['scenarios'][scenarioName].responses[statusCode]['INTERNAL_ERROR'] = util.inspect(err, {depth: null});
                    }
                  }
                }
              }
            }
          }
        }
        return callback(null);
      });
    }
  ], function (err, result) {
    console.dir(finalValidationResult, {depth: null, colors: true});
    if (err) { console.log(err); return;}
    return;
  });
});

//wrapper to validateModel of swagger-tools
function validateModel(modelReference, data) {
  if (!modelReference) {
    throw new Error('modelReference cannot be null or undefined. It must be of a string. Example: "#/definitions/foo".');
  }
  if (!data) {
    throw new Error('data cannot be null or undefined. It must be of a JSON object or a JSON array.');
  }
 
  return function (callback) {
    spec.validateModel(specInJson, modelReference, data, callback);
  }
}

function run(genfun) {
  // instantiate the generator object
  var gen = genfun();
  // This is the async loop pattern
  function next(err, answer) {
    var res;
    if (err) {
      // if err, throw it into the wormhole
      return gen.throw(err);
    } else {
      // if good value, send it
      res = gen.next(answer);
    }
    if (!res.done) {
      // if we are not at the end
      // we have an async request to
      // fulfill, we do this by calling 
      // `value` as a function
      // and passing it a callback
      // that receives err, answer
      // for which we'll just use `next()`
      res.value(next);
    }
  }
  // Kick off the async loop
  next();
}

//validates constraints
function validateConstraints(schema, value, objectName) {
  constraints.forEach(function (constraintType) {
    if (schema[constraintType] !== null && schema[constraintType] !== undefined) {
      if (constraintType.match(/^maximum$/ig) !== null) {
        if (schema['exclusiveMaximum']) {
          if (value >= schema[constraintType]) {
            throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint ' + 
              '\'exclusiveMaximum\': true and \'maximum\': %s', objectName, value, schema[constraintType]));
          }
        } else {
          if (value > schema[constraintType]) {
            throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'maximum\': %s', 
            objectName, value, schema[constraintType]));
          }
        }
      } else if (constraintType.match(/^minimum$/ig) !== null) {
        if (schema['exclusiveMinimum']) {
          if (value <= schema[constraintType]) {
            throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint ' + 
              '\'exclusiveMinimum\': true and \'minimum\': %s',
            objectName, value, schema[constraintType]));
          }
        } else {
          if (value < schema[constraintType]) {
            throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'minimum\': %s', 
            objectName, value, schema[constraintType]));
          }
        } 
      } else if (constraintType.match(/^maxItems$/ig) !== null) {
        if (value.length > schema[constraintType]) {
          throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'maxItems\': %s', 
          objectName, value, schema[constraintType]));
        }
      } else if (constraintType.match(/^maxLength$/ig) !== null) {
        if (value.length > schema[constraintType]) {
          throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'maxLength\': %s', 
          objectName, value, schema[constraintType]));
        }
      } else if (constraintType.match(/^minItems$/ig) !== null) {
        if (value.length < schema[constraintType]) {
          throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'minItems\': %s', 
          objectName, value, schema[constraintType]));
        }
      } else if (constraintType.match(/^minLength$/ig) !== null) {
        if (value.length < schema[constraintType]) {
          throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'minLength\': %s', 
          objectName, value, schema[constraintType]));
        }
      } else if (constraintType.match(/^multipleOf$/ig) !== null) {
        if (value.length % schema[constraintType] !== 0) {
          throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'multipleOf\': %s', 
          objectName, value, schema[constraintType]));
        }
      } else if (constraintType.match(/^pattern$/ig) !== null) {
        if (value.match(schema[constraintType].split('/').join('\/')) === null) {
          throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'pattern\': %s', 
          objectName, value, schema[constraintType]));
        }
      } else if (constraintType.match(/^uniqueItems/ig) !== null) {
        if (schema[constraintType]) {
          if (value.length !== value.filter(function (item, i, ar) { { return ar.indexOf(item) === i; } }).length) {
            throw new Error(util.format('\'%s\' with value \'%s\' should satify the constraint \'uniqueItems\': %s', 
          objectName, value, schema[constraintType]));
          }
        }
      } else if (constraintType.match(/^enum/ig) !== null) {
        var isPresent = schema[constraintType].some(function (item) {
           return item === value;
        });
        if (!isPresent && schema['x-ms-enum'] && !Boolean(schema['x-ms-enum']['modelAsString'])) {
          throw new Error(util.format('%s is not a valid value for %s. The valid values are: %s', 
            value, objectName, JSON.stringify(schema[constraintType])));
        }
      }
    }
  });
}

//entry point for type validations
function validateType(schema, data) {
  if (schema.type.match(/^(number|string|boolean|integer)$/ig) !== null) {
    if (schema.format) {
      if (schema.format.match(/^(date|date-time|timespan|duration|date-time-rfc1123|unixtime)$/ig) !== null) {
        validateDateTypes(schema, data);
      } else if (schema.format.match(/^byte$/ig) !== null) {
        validateBufferType(schema, data);
      } else if (schema.format.match(/^base64url$/ig) !== null) {
        validateBase64UrlType(schema, data);
      }
    } else {
      validateBasicTypes(schema, data);
    }
  } else {
    throw new Error(util.format('Unknown type: "%s" provided for parameter: "%s"', schema.type, schema.name));
  }
};

function validateBasicTypes(schema, value) {
  if (value !== null && value !== undefined) {
    if (schema.type.match(/^(number|integer)$/ig) !== null) {
      if (typeof value !== 'number') {
        throw new Error(util.format('%s with value %s must be of type number.', schema.name, value));
      }
    } else if (schema.type.match(/^string$/ig) !== null) {
      if (typeof value.valueOf() !== 'string') {
        throw new Error(util.format('%s with value \'%s\' must be of type string.',  schema.name, value));
      }
      if (schema.format && schema.format.match(/^uuid$/ig) !== null) {
        if (!(typeof value.valueOf() === 'string' && isValidUuid(value))) {
          throw new Error(util.format('%s with value \'%s\' must be of type string and a valid uuid.',  schema.name, value));
        }
      }
    } else if (schema.type.match(/^boolean$/ig) !== null) {
      if (typeof value !== 'boolean') {
        throw new Error(util.format('%s with value %s must be of type boolean.',  schema.name, value));
      }
    }
  }
}

function isValidUuid(uuid) {
  var validUuidRegex = new RegExp('^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$', 'ig');
  return validUuidRegex.test(uuid);
};

function validateBufferType(schema, value) {
  if (value !== null && value !== undefined) {
    if (!Buffer.isBuffer(value)) {
      throw new Error(util.format('%s must be of type Buffer.', schema.name));
    }
  }
}

function validateBase64UrlType(schema, value) {
  if (value !== null && value !== undefined) {
    if (!Buffer.isBuffer(value)) {
      throw new Error(util.format('%s must be of type Buffer.', schema.name));
    }
  }
}

function validateDateTypes(schema, value) {
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

// Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
// because the buffer-to-string conversion in `fs.readFile()`
// translates it to FEFF, the UTF-16 BOM.
function stripBOM(content) {
  if (Buffer.isBuffer(content)) {
    content = content.toString();
  }
  if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
    content = content.slice(1);
  }
  return content;
}

function parseJSONSync(swaggerSpecPath) {
  return JSON.parse(stripBOM(fs.readFileSync(swaggerSpecPath, 'utf8')));
}

function validateNonBodyParameter(schema, data, operationId, scenarioName) {
  var result = {
    validationError: null,
    typeError: null
  };
  try {
    validateConstraints(schema, data, schema.name);
  } catch (validationError) {
    result.validationError = `${validationError.message} in operation: "${operationId}".`;
  }
  //type validation
  try {
    validateType(schema, data);
  } catch (typeError) {
    result.typeError = `${typeError.message} in operation: "${operationId}".`;
  }
  return result; 
}


