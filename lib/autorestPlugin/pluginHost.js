/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const vscode_jsonrpc_1 = require("vscode-jsonrpc");
const linq = require('linq');
const jsonPath = require('jsonpath');
const yaml = require("js-yaml");
const utils = require("../util/utils");
const log = require('../util/logging');
const SpecValidator = require('../validators/specValidator');
const extensionBase = require('autorest-extension-base');

const openAPIDocUrl = "https://github.com/Azure/oav";

exports = module.exports;

const extension = new extensionBase.AutoRestExtension();
const modelValidatorPluginName = "model-validator";
const modelValidationCategory = "ExampleModelViolation"

function FormattedOutput(channel, details, code, text, source) {
  this.channel = channel;
  this.details = details;
  this.code = code;
  this.text = text;
  this.source = source;
}

extension.Add(modelValidatorPluginName, autoRestApi => {
  return autoRestApi.ListInputs().then(function (swaggerFileNames) {
    const promises = [];
    for (const swaggerFileName of swaggerFileNames) {
      promises.push(
        autoRestApi.ReadFile(swaggerFileName).then(function (swaggerFile) {
          const swagger = yaml.safeLoad(swaggerFile);
          return exports.openApiValidationExample(swagger, swaggerFileName).then(function (exampleValidationResults) {
            for (const result of exampleValidationResults) {
              autoRestApi.Message({ Channel: result.channel, Text: result.text, Details: result.details, Key: result.code, Source: result.source });
            }
            // console.error(JSON.stringify(exampleValidationResults, null, 2));
          })
        })
      );
    }
    return Promise.all(promises).then(_ => true)
  })
});

exports.openApiValidationExample = function openApiValidationExample(swagger, swaggerFileName, options) {
  var formattedResult = [];
  if (!options) options = {};
  options.consoleLogLevel = "off";
  log.consoleLogLevel = options.consoleLogLevel;
  let specVal = new SpecValidator(swaggerFileName, swagger, options);
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
            var result = new FormattedOutput("verbose", scenarioItem, scenario, [modelValidationCategory], "Model validator found issue (see details).", [{ document: swaggerFileName, Position: { path: xmsexPath } }])
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
                resultDetails = { type: "Error", code: error.code, message: error.message, id: error.id, validationCategory: modelValidationCategory, innerErrors: innerError };
                result = new FormattedOutput("error", resultDetails, [error.code, error.id, modelValidationCategory],
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
                  resultDetails = { type: "Error", code: error.code, message: error.message, id: error.id, validationCategory: modelValidationCategory, innerErrors: innerError };
                  result = new FormattedOutput("error", resultDetails, [error.code, error.id, modelValidationCategory],
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

extension.Run();

