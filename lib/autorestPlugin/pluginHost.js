/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const linq = require('linq');
const jsonPath = require('jsonpath');
const yaml = require("./yaml.js");
const utils = require("../util/utils");
const validator = require("../validate");
const log = require('../util/logging');
const SpecValidator = require('../validators/specValidator')

const openAPIDocUrl = "https://github.com/Azure/oav";

exports = module.exports;

class OpenApiValidationExample {
  Process(sessionId, initiator) {
    return initiator.ListInputs(sessionId).then(function (swaggerFileNames) {
      const promises = [];
      for (const swaggerFileName of swaggerFileNames) {
        promises.push(
          initiator.ReadFile(sessionId, swaggerFileName).then(function (swaggerFile) {
            const swagger = yaml.Parse(swaggerFile);
            return exports.openApiValidationExample(swagger, swaggerFileName).then(function (exampleValidationResults) {
              for (const result of exampleValidationResults) {
                initiator.Message(sessionId, { Channel: result.channel, Text: result.text, Details: result.details, Key: result.code, Source: result.source });
              }
              console.error(JSON.stringify(exampleValidationResults, null, 2));
            })
          })
        );
      }
      return Promise.all(promises).then(_ => true)
    })
  }
}

OpenApiValidationExample.Name = "model-validator";

function FormattedOutput(channel, details, code, text, source) {
  this.channel = channel;
  this.details = details;
  this.code = code;
  this.text = text;
  this.source = source;
}

exports.openApiValidationExample = function openApiValidationExample(swagger, swaggerFileName) {
  var formattedResult = [];
  let specVal = new SpecValidator("swagger.json", swagger, { "consoleLogLevel": "off" });
  //console.error(JSON.stringify(swagger, null, 2));
  return specVal.initialize().then(function () {
    specVal.validateOperations();
    Promise.resolve(specVal.specValidationResult).then(function (specValidationResult) {
      for (var op in specValidationResult.operations) {
        const xmsExamplesNode = specValidationResult.operations[op]["x-ms-examples"];
        for (var scenario in xmsExamplesNode.scenarios) {
          // invalid? meaning that there's an issue found in the validation
          var scenarioItem = xmsExamplesNode.scenarios[scenario];
          if (scenarioItem.isValid === false) {
            // get path to x-ms-examples in swagger
            const xmsexPath = linq.from(jsonPath.nodes(swagger, `$.paths[*][?(@.operationId==='${op}')]["x-ms-examples"]`))
              .select(x => x.path)
              .firstOrDefault();
            if (!xmsexPath) {
              throw new Error("Model Validator: Path to x-ms-examples not found.");
            }
            //console.error(JSON.stringify(scenarioItem, null, 2));
            var result = new FormattedOutput("verbose", scenarioItem, scenario, ["ExampleModelViolation"], "Model validator found issue (see details).", [{ document: swaggerFileName, Position: { path: xmsexPath } }])
            formattedResult.push(result);

            // request
            const request = scenarioItem.request;
            if (request.isValid === false) {
              const error = request.error;
              const innerErrors = error.innerErrors;
              if (!innerErrors || !innerErrors.length) {
                throw new Error("Model Validator: Unexpected format.");
              }
              for (const innerError of innerErrors) {
                const path = ConvertIndicesFromStringToNumbers(innerError.path);
                //console.error(JSON.stringify(error, null, 2));
                result = new FormattedOutput("error", error, [error.code, error.id, "ExampleModelViolation"],
                  innerError.message + ". \nScenario: " + scenario + ". \nDetails: " + JSON.stringify(innerError.errors, null, 2) + "\nMore info: " + openAPIDocUrl + "#" + error.id.toLowerCase() + "-" + error.code.toLowerCase() + "\n",
                  [{ document: swaggerFileName, Position: { path: path } }]);
                formattedResult.push(result);
              }
            }

            // responses
            for (var responseCode in scenarioItem.responses) {
              const response = scenarioItem.responses[responseCode];
              if (response.isValid === false) {
                const error = response.error;
                const innerErrors = error.innerErrors;
                if (!innerErrors || !innerErrors.length) {
                  throw new Error("Model Validator: Unexpected format.");
                }
                for (const innerError of innerErrors) {
                  //console.error(JSON.stringify(error, null, 2));
                  result = new FormattedOutput("error", error, [error.code, error.id, "ExampleModelViolation"],
                    innerError.message + ". \nScenario: " + scenario + ". \nDetails: " + JSON.stringify(innerError.errors, null, 2) + "\nMore info: " + openAPIDocUrl + "#" + error.id.toLowerCase() + "-" + error.code.toLowerCase() + "\n",
                    [{ document: swaggerFileName, Position: { path: xmsexPath.slice(0, xmsexPath.length - 1).concat(["responses", responseCode]) } }
                    ])
                  formattedResult.push(result);
                }
              }
            }
          }
        }
      }
    })
    return formattedResult;
  }).catch(function (err) {
    console.error(err);
    return Promise.reject(err);
  });
};
/**
 * Path comes with indices as strings in "inner errors", so converting those to actual numbers for path to work.
 */
function ConvertIndicesFromStringToNumbers(path) {
  const result = path.slice();
  for (let i = 1; i < result.length; ++i) {
    const num = parseInt(result[i]);
    if (!isNaN(num) && result[i - 1] === "parameters") {
      result[i] = num;
    }
  }
  return result;
}

class PluginHost {
  constructor(initiator) {
    this.initiator = initiator;
  }

  GetPluginNames() {
    return [/*OpenApiValidationSemantic.Name, */ OpenApiValidationExample.Name];
  }

  Process(pluginName, sessionId) {
    switch (pluginName) {
      // case OpenApiValidationSemantic.Name:
      //   return new OpenApiValidationSemantic().Process(sessionId, this.initiator);
      case OpenApiValidationExample.Name:
        return new OpenApiValidationExample().Process(sessionId, this.initiator);
      default:
        return false;
    }
  }
}

var IAutoRestPluginInitiator_Types;
(function (IAutoRestPluginInitiator_Types) {
  IAutoRestPluginInitiator_Types.ReadFile = new vscode_jsonrpc_1.RequestType2("ReadFile");
  IAutoRestPluginInitiator_Types.GetValue = new vscode_jsonrpc_1.RequestType2("GetValue");
  IAutoRestPluginInitiator_Types.ListInputs = new vscode_jsonrpc_1.RequestType1("ListInputs");
  IAutoRestPluginInitiator_Types.WriteFile = new vscode_jsonrpc_1.NotificationType4("WriteFile");
  IAutoRestPluginInitiator_Types.Message = new vscode_jsonrpc_1.NotificationType4("Message");
})(IAutoRestPluginInitiator_Types = exports.IAutoRestPluginInitiator_Types || (exports.IAutoRestPluginInitiator_Types = {}));

var IAutoRestPluginTarget_Types;
(function (IAutoRestPluginTarget_Types) {
  IAutoRestPluginTarget_Types.GetPluginNames = new vscode_jsonrpc_1.RequestType0("GetPluginNames");
  IAutoRestPluginTarget_Types.Process = new vscode_jsonrpc_1.RequestType2("Process");
})(IAutoRestPluginTarget_Types = exports.IAutoRestPluginTarget_Types || (exports.IAutoRestPluginTarget_Types = {}));

function main() {
  // connection setup
  const channel = vscode_jsonrpc_1.createMessageConnection(process.stdin, process.stdout, {
    error(message) { console.error(message); },
    info(message) { console.info(message); },
    log(message) { console.log(message); },
    warn(message) { console.warn(message); }
  });
  const initiator = {
    ReadFile(sessionId, filename) {
      return channel.sendRequest(IAutoRestPluginInitiator_Types.ReadFile, sessionId, filename);
    },
    GetValue(sessionId, key) {
      return channel.sendRequest(IAutoRestPluginInitiator_Types.GetValue, sessionId, key);
    },
    ListInputs(sessionId) {
      return channel.sendRequest(IAutoRestPluginInitiator_Types.ListInputs, sessionId);
    },
    WriteFile(sessionId, filename, content, sourceMap) {
      channel.sendNotification(IAutoRestPluginInitiator_Types.WriteFile, sessionId, filename, content, sourceMap);
    },
    Message(sessionId, message, path, sourceFile) {
      channel.sendNotification(IAutoRestPluginInitiator_Types.Message, sessionId, message, path, sourceFile);
    }
  };
  const target = new PluginHost(initiator);
  channel.onRequest(IAutoRestPluginTarget_Types.GetPluginNames, target.GetPluginNames.bind(target));
  channel.onRequest(IAutoRestPluginTarget_Types.Process, target.Process.bind(target));
  // activate
  channel.listen();
}

main();
