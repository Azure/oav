// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var util = require('util'),
  msRest = require('ms-rest'),
  msrestazure = require('ms-rest-azure'),
  ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient,
  HttpRequest = msRest.WebResource,
  ResponseWrapper = require('./responseWrapper'),
  SpecValidator = require('./specValidator'),
  utils = require('./util/utils'),
  log = require('./util/logging'),
  Constants = require('./util/constants'),
  EnvironmentVariables = Constants.EnvironmentVariables;

class ExecutionEngine {
  constructor() {
  }

  sanitizeParameters(exampleParameters) {
    let self = this;
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

  liveTest(specPath, operationId) {
    let self = this;
    self.validateEnvironmentVariables();
    log.transports.console.level = 'info';
    let clientId = process.env[EnvironmentVariables.ClientId];
    let domain = process.env[EnvironmentVariables.Domain];
    let secret = process.env[EnvironmentVariables.ApplicationSecret];
    let subscriptionId = process.env[EnvironmentVariables.AzureSubscriptionId];
    let location = process.env[EnvironmentVariables.AzureLocation] || 'westus';
    let resourceGroupName = process.env[EnvironmentVariables.AzureResourcegroup] || utils.generateRandomId('testrg');
    let validator = new SpecValidator(specPath);
    let operation, xmsExamples;
    validator.initialize().then(function () {
      log.info(`Running live test using x-ms-examples in ${operationId} in  ${specPath}:\n`);
      operation = validator.getOperationById(operationId);
      xmsExamples = operation[Constants.xmsExamples];
      if (xmsExamples) {
        for (let scenario in xmsExamples) {
          let xmsExample = xmsExamples[scenario];
          let parameters = self.sanitizeParameters(xmsExample.parameters);
          let result = validator.validateRequest(operation, xmsExample.parameters);
          if (result.validationResult && result.validationResult.errors && result.validationResult.errors.length) {
            let msg = `Cannot proceed ahead with the live test for operation: ${operationId}. Found validation errors in the request.\n` +
              `${util.inspect(result.validationResult.errors, { depth: null })}`;
            throw new Error(msg);
          }
          let req = result.request;
          if (!req) {
            throw new Error(`Cannot proceed ahead with the live test for operation: ${operationId}. The request object is undefined.`);
          }
          if (req.body !== null && req.body !== undefined) {
            req.body = JSON.stringify(req.body);
          }
          msrestazure.loginWithServicePrincipalSecret(clientId, secret, domain, function (err, creds, subscriptions) {
            if (err) {
              throw err;
            }
            let resourceClient = new ResourceManagementClient(creds, subscriptionId);
            let client = new msrestazure.AzureServiceClient(creds);
            self.createResourceGroup(resourceClient, location, resourceGroupName, function (err, resourceGroup) {
              if (err) {
                throw err;
              }
              client.sendRequest(req, function (err, result, request, response) {
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
  }

  createResourceGroup(resourceClient, location, resourceGroupName, callback) {
    let self = this;
    resourceClient.resourceGroups.get(resourceGroupName, function (err, result, request, response) {
      if (err && err.statusCode === 404) {
        log.info(`Creating resource group: \'${resourceGroupName}\', if not present.`);
        let groupParameters = { location: location, tags: { 'live-test': 'live-test' } };
        return resourceClient.resourceGroups.createOrUpdate(resourceGroupName, groupParameters, callback);
      } else {
        return callback(null, result);
      }
    });
  }

  getResourceGroup(resourceClient, resourceGroupName, callback) {
    let self = this;
    log.info(`Searching ResourceGroup: ${resourceGroupName}.`)
    resourceClient.resourceGroups.get(resourceGroupName, callback);
  }

  validateEnvironmentVariables() {
    let self = this;
    var envs = [];
    if (!process.env[EnvironmentVariables.ClientId]) envs.push(EnvironmentVariables.ClientId);
    if (!process.env[EnvironmentVariables.Domain]) envs.push(EnvironmentVariables.Domain);
    if (!process.env[EnvironmentVariables.ApplicationSecret]) envs.push(EnvironmentVariables.ApplicationSecret);
    if (!process.env[EnvironmentVariables.AzureSubscriptionId]) envs.push(EnvironmentVariables.AzureSubscriptionId);
    if (envs.length > 0) {
      throw new Error(util.format('please set/export the following environment variables: %s', envs.toString()));
    }
  }

}

module.exports = ExecutionEngine;