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
    for (let i = 0; i < docs.length; i++) {
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
    log.error(err);
    return Promise.reject(err);
  });
};

exports.validateSpec = function validateSpec(specPath, json, consoleLogLevel, logFilepath) {
  if (consoleLogLevel) { log.consoleLogLevel = consoleLogLevel; }
  if (logFilepath) {
    log.filepath = logFilepath;
  } else {
    log.filepath = log.filepath;
  }
  if (json) {
    log.consoleLogLevel = 'json';
  }
  let validator = new SpecValidator(specPath);
  exports.finalValidationResult[specPath] = validator.specValidationResult;
  return validator.initialize().then(function () {
    log.info(`Semantically validating  ${specPath}:\n`);
    return validator.validateSpec().then(function (result) {
      exports.updateEndResultOfSingleValidation(validator);
      exports.logDetailedInfo(validator, json);
      return Promise.resolve(validator.specValidationResult);
    });
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.validateCompositeSpec = function validateCompositeSpec(compositeSpecPath, json) {
  return exports.getDocumentsFromCompositeSwagger(compositeSpecPath).then(function (docs) {
    let promiseFactories = docs.map(function (doc) {
      return exports.validateSpec(doc, json);
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.validateExamples = function validateExamples(specPath, operationIds, json, consoleLogLevel, logFilepath) {
  if (consoleLogLevel) { log.consoleLogLevel = consoleLogLevel; }
  if (logFilepath) {
    log.filepath = logFilepath;
  } else {
    log.filepath = log.filepath;
  }
  if (json) {
    log.consoleLogLevel = 'json';
  }
  let validator = new SpecValidator(specPath);
  exports.finalValidationResult[specPath] = validator.specValidationResult;
  return validator.initialize().then(function () {
    log.info(`Validating "examples" and "x-ms-examples" in  ${specPath}:\n`);
    validator.validateOperations(operationIds);
    exports.updateEndResultOfSingleValidation(validator);
    exports.logDetailedInfo(validator, json);
    return Promise.resolve(validator.specValidationResult);
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.validateExamplesInCompositeSpec = function validateExamplesInCompositeSpec(compositeSpecPath, json) {
  return exports.getDocumentsFromCompositeSwagger(compositeSpecPath).then(function (docs) {
    let promiseFactories = docs.map(function (doc) {
      return exports.validateExamples(doc, json);
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.updateEndResultOfSingleValidation = function updateEndResultOfSingleValidation(validator) {
  if (validator.specValidationResult.validityStatus) {
    if (log.consoleLogLevel !== 'json') {
      let consoleLevel = log.consoleLogLevel;
      log.consoleLogLevel = 'info';
      log.info('No Errors were found.');
      log.consoleLogLevel = consoleLevel;
    }
  }
  if (!validator.specValidationResult.validityStatus) {
    exports.finalValidationResult.validityStatus = validator.specValidationResult.validityStatus;
  }
  return;
};

exports.logDetailedInfo = function logDetailedInfo(validator, json) {
  if (json) {
    console.dir(validator.specValidationResult, { depth: null, colors: true });
  }
  log.silly('############################');
  log.silly(validator.specValidationResult);
  log.silly('----------------------------');
};

exports = module.exports;