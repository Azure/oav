// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var fs = require('fs'),
  path = require('path'),
  msrest = require('ms-rest'),
  msrestazure = require('ms-rest-azure'),
  ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient,
  log = require('./util/logging'),
  utils = require('./util/utils'),
  Constants = require('./util/constants'),
  path = require('path'),
  util = require('util'),
  SpecValidator = require('./validators/specValidator'),
  WireFormatGenerator = require('./wireFormatGenerator'),
  XMsExampleGenerator = require('./xMsExampleGenerator'),
  SpecResolver = require('./validators/specResolver');

exports = module.exports;

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

exports.validateSpec = function validateSpec(specPath, options) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  let validator = new SpecValidator(specPath, null, options);
  exports.finalValidationResult[specPath] = validator.specValidationResult;
  return validator.initialize().then(function () {
    log.info(`Semantically validating  ${specPath}:\n`);
    return validator.validateSpec().then(function (result) {
      exports.updateEndResultOfSingleValidation(validator);
      exports.logDetailedInfo(validator);
      return Promise.resolve(validator.specValidationResult);
    });
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.validateCompositeSpec = function validateCompositeSpec(compositeSpecPath, options) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  return exports.getDocumentsFromCompositeSwagger(compositeSpecPath).then(function (docs) {
    options.consoleLogLevel = log.consoleLogLevel;
    options.logFilepath = log.filepath;
    let promiseFactories = docs.map(function (doc) {
      return function () { return exports.validateSpec(doc, options) };
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.validateExamples = function validateExamples(specPath, operationIds, options) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  let validator = new SpecValidator(specPath, null, options);
  exports.finalValidationResult[specPath] = validator.specValidationResult;
  return validator.initialize().then(function () {
    log.info(`Validating "examples" and "x-ms-examples" in  ${specPath}:\n`);
    validator.validateOperations(operationIds);
    exports.updateEndResultOfSingleValidation(validator);
    exports.logDetailedInfo(validator);
    return Promise.resolve(validator.specValidationResult);
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.validateExamplesInCompositeSpec = function validateExamplesInCompositeSpec(compositeSpecPath, options) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  return exports.getDocumentsFromCompositeSwagger(compositeSpecPath).then(function (docs) {
    options.consoleLogLevel = log.consoleLogLevel;
    options.logFilepath = log.filepath;
    let promiseFactories = docs.map(function (doc) {
      return function () { return exports.validateExamples(doc, options); }
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.resolveSpec = function resolveSpec(specPath, outputDir, options) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  let specFileName = path.basename(specPath);
  let resolver;
  return utils.parseJson(specPath).then((result) => {
    resolver = new SpecResolver(specPath, result, options);
    return resolver.resolve();
  }).then(() => {
    let resolvedSwagger = JSON.stringify(resolver.specInJson, null, 2);
    if (outputDir !== './' && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    let outputFilepath = `${path.join(outputDir, specFileName)}`;
    fs.writeFileSync(`${path.join(outputDir, specFileName)}`, resolvedSwagger, { encoding: 'utf8' });
    console.log(`Saved the resolved spec at "${outputFilepath}".`)
    return Promise.resolve();
  }).catch((err) => {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.resolveCompositeSpec = function resolveCompositeSpec(specPath, outputDir, options) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  return exports.getDocumentsFromCompositeSwagger(compositeSpecPath).then(function (docs) {
    options.consoleLogLevel = log.consoleLogLevel;
    options.logFilepath = log.filepath;
    let promiseFactories = docs.map(function (doc) {
      return function () { return exports.resolveSpec(doc, outputDir, options); }
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};


exports.generateWireFormat = function generateWireFormat(specPath, outDir, operationIds, options) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  let wfGenerator = new WireFormatGenerator(specPath, null, outDir);
  return wfGenerator.initialize().then(function () {
    log.info(`Generating wire format request and responses for swagger spec: "${specPath}":\n`);
    wfGenerator.processOperations(operationIds);
    return Promise.resolve();
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.generateWireFormatInCompositeSpec = function generateWireFormatInCompositeSpec(compositeSpecPath, outDir, options) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  return exports.getDocumentsFromCompositeSwagger(compositeSpecPath).then(function (docs) {
    options.consoleLogLevel = log.consoleLogLevel;
    options.logFilepath = log.filepath;
    let promiseFactories = docs.map(function (doc) {
      return function () { return exports.generateWireFormat(doc, outDir, null, options); }
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err) {
    log.error(err);
    return Promise.reject(err);
  });
};

exports.updateEndResultOfSingleValidation = function updateEndResultOfSingleValidation(validator) {
  if (validator.specValidationResult.validityStatus) {
    if (!(log.consoleLogLevel === 'json' || log.consoleLogLevel === 'off')) {
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

exports.logDetailedInfo = function logDetailedInfo(validator) {
  if (log.consoleLogLevel === 'json') {
    console.dir(validator.specValidationResult, { depth: null, colors: true });
  }
  log.silly('############################');
  log.silly(validator.specValidationResult);
  log.silly('----------------------------');
};

exports.generateXMsExamples = function generateXMsExamples(specPath, recordings, options) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  let xMsExampleGenerator = new XMsExampleGenerator(specPath, recordings, options);
  return xMsExampleGenerator.generate();
};