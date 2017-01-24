// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var msrest = require('ms-rest'),
  msrestazure = require('ms-rest-azure'),
  ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient,
  log = require('./lib/util/logging'),
  utils = require('./lib/util/utils'),
  Constants = require('./lib/util/constants'),
  path = require('path'),
  util = require('util'),
  SpecValidator = require('./lib/specValidator');

exports.finalValidationResult = { validityStatus: true };

exports.getDocumentsFromCompositeSwagger = function getDocumentsFromCompositeSwagger(compositeSpecPath) {
  let compositeSwagger;
  let finalDocs = [];
  return utils.parseJson(compositeSpecPath).then(function (result) {
    compositeSwagger = result;
    if (!(compositeSwagger.documents && Array.isArray(compositeSwagger.documents) && compositeSwagger.documents.length > 0)) {
      throw new Error(`CompositeSwagger - ${compositeSpecPath} must contain a documents property and it must be of type array and it must be a non empty array.`);
    }
    let docs = compositeSwagger.documents;
    let basePath = path.dirname(compositeSpecPath);
    for (let i=0; i<docs.length; i++) {
      if (docs[i].startsWith('.')) {
        docs[i] = docs[i].substring(1);
      }
      let individualPath = '';
      if (docs[i].startsWith('http')) {
        individualPath = docs[i];
      } else {
        individualPath = basePath + docs[i];
      }
      finalDocs.push(individualPath);
    }
    return finalDocs;
  }).catch(function (err) {
    return Promise.reject(err);
  });
};

exports.validateSpec = function validateSpec(specPath, json) {
  let validator = new SpecValidator(specPath);
  exports.finalValidationResult[specPath] = validator.specValidationResult;
  validator.initialize().then(function() {
    log.info(`Semantically validating  ${specPath}:\n`);
    validator.validateSpec();
    exports.updateEndResultOfSingleValidation(validator);
    exports.logDetailedInfo(validator, json);
    return;
  }).catch(function(err) {
    log.error(err);
    return;
  });
};

exports.validateCompositeSpec = function validateCompositeSpec(compositeSpecPath, json){
  return exports.getDocumentsFromCompositeSwagger(compositeSpecPath).then(function(docs) {
    let promiseFactories = docs.map(function(doc) {
      return exports.validateSpec(doc, json);
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err) {
    log.error(err);
  });
};

exports.validateExamples = function validateExamples(specPath, operationIds, json) {
  let validator = new SpecValidator(specPath);
  exports.finalValidationResult[specPath] = validator.specValidationResult;
  validator.initialize().then(function() {
    log.info(`Validating "examples" and "x-ms-examples" in  ${specPath}:\n`);
    validator.validateOperations(operationIds);
    exports.updateEndResultOfSingleValidation(validator);
    exports.logDetailedInfo(validator, json);
    return;
  }).catch(function (err) {
    log.error(err);
  });
};

exports.validateExamplesInCompositeSpec = function validateExamplesInCompositeSpec(compositeSpecPath, json){
  return exports.getDocumentsFromCompositeSwagger(compositeSpecPath).then(function(docs) {
    let promiseFactories = docs.map(function(doc) {
      return exports.validateExamples(doc, json);
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err) {
    log.error(err);
  });
};

exports.updateEndResultOfSingleValidation = function updateEndResultOfSingleValidation(validator) {
  if (validator.specValidationResult.validityStatus) {
    let consoleLevel = log.consoleLogLevel;
    log.consoleLogLevel = 'info';
    log.info('No Errors were found.');
    log.consoleLogLevel = consoleLevel;
  }
  if (!validator.specValidationResult.validityStatus) {
    exports.finalValidationResult.validityStatus = validator.specValidationResult.validityStatus;
  }
  return;
};

exports.logDetailedInfo = function logDetailedInfo(validator, json) {
  if (json) {
    let consoleLevel = log.consoleLogLevel;
    log.consoleLogLevel = 'info';
    log.info('############################');
    log.info(validator.specValidationResult);
    log.info('----------------------------');
    log.consoleLogLevel = consoleLevel;
  } else {
    log.silly('############################');
    log.silly(validator.specValidationResult);
    log.silly('----------------------------');
  }
};

exports.sanitizeParameters = function sanitizeParameters(exampleParameters) {
  if (exampleParameters) {
    if (exampleParameters.subscriptionId) {
      exampleParameters.subscriptionId = process.env['AZURE_SUBSCRIPTION_ID'];
    }
    if (exampleParameters.resourceGroupName) {
      exampleParameters.resourceGroupName = process.env['AZURE_RESOURCE_GROUP'];
    }
  }
  return exampleParameters;
};

exports.liveTest = function liveTest(specPath, operationId) {
  exports.validateEnvironmentVariables();
  log.transports.console.level = 'info';
  let clientId = process.env['CLIENT_ID'];
  let domain = process.env['DOMAIN'];
  let secret = process.env['APPLICATION_SECRET'];
  let subscriptionId = process.env['AZURE_SUBSCRIPTION_ID'];
  let location = process.env['AZURE_LOCATION'] || 'westus';
  let resourceGroupName = process.env['AZURE_RESOURCE_GROUP'] || utils.generateRandomId('testrg');
  let validator = new SpecValidator(specPath);
  let operation, xmsExamples;
  validator.initialize().then(function() {
    log.info(`Running live test using x-ms-examples in ${operationId} in  ${specPath}:\n`);
    operation = validator.getOperationById(operationId);
    xmsExamples = operation[Constants.xmsExamples];
    if (xmsExamples) {
      for (let scenario in xmsExamples) {
        let xmsExample = xmsExamples[scenario];
        let parameters = exports.sanitizeParameters(xmsExample.parameters);
        let result = validator.validateRequest(operation, xmsExample.parameters);
        if (result.validationResult && result.validationResult.errors && result.validationResult.errors.length) {
          let msg = `Cannot proceed ahead with the live test for operation: ${operationId}. Found validation errors in the request.\n` + 
            `${util.inspect(result.validationResult.errors, {depth: null})}`;
          throw new Error(msg);
        }
        let req = result.request;
        if (!req) {
          throw new Error(`Cannot proceed ahead with the live test for operation: ${operationId}. The request object is undefined.`);
        }
        if (req.body !== null && req.body !== undefined) {
          req.body = JSON.stringify(req.body);
        }
        msrestazure.loginWithServicePrincipalSecret(clientId, secret, domain, function(err, creds, subscriptions) {
          if (err) {
            throw err;
          }
          let resourceClient = new ResourceManagementClient(creds, subscriptionId);
          let client = new msrestazure.AzureServiceClient(creds);
          exports.createResourceGroup(resourceClient, location, resourceGroupName, function(err, resourceGroup) {
            if (err) {
              throw err;
            }
            client.sendRequest(req, function(err, result, request, response) {
              log.info(request);
              log.info(response);
              if (err) {
                throw err;
              }
              log.info(result);
            });
          });
        });
      }
    }

  }).catch(function (err) {
    log.error(err);
  });
};

exports.createResourceGroup = function createResourceGroup(resourceClient, location, resourceGroupName, callback) {
  resourceClient.resourceGroups.get(resourceGroupName, function (err, result, request, response) {
    if (err && err.statusCode === 404) {
      log.info(`Creating resource group: \'${resourceGroupName}\', if not present.`);
      let groupParameters = { location: location, tags: { 'live-test': 'live-test'} };
      return resourceClient.resourceGroups.createOrUpdate(resourceGroupName, groupParameters, callback);
    } else {
      return callback(null, result);
    }
  });
};

exports.getResourceGroup = function getResourceGroup(resourceClient, resourceGroupName, callback) {
  log.info(`Searching ResourceGroup: ${resourceGroupName}.`)
  resourceClient.resourceGroups.get(resourceGroupName, callback);
}

exports.validateEnvironmentVariables = function validateEnvironmentVariables() {
  var envs = [];
  if (!process.env['CLIENT_ID']) envs.push('CLIENT_ID');
  if (!process.env['DOMAIN']) envs.push('DOMAIN');
  if (!process.env['APPLICATION_SECRET']) envs.push('APPLICATION_SECRET');
  if (!process.env['AZURE_SUBSCRIPTION_ID']) envs.push('AZURE_SUBSCRIPTION_ID');
  if (envs.length > 0) {
    throw new Error(util.format('please set/export the following environment variables: %s', envs.toString()));
  }
};

exports = module.exports;