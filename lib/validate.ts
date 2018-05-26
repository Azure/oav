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
  path = require('path'),
  SpecValidator = require('./validators/specValidator'),
  WireFormatGenerator = require('./wireFormatGenerator'),
  XMsExampleExtractor = require('./xMsExampleExtractor'),
  SpecResolver = require('./validators/specResolver'),
  UmlGenerator = require('./umlGenerator');

export let finalValidationResult: any = { validityStatus: true };

export function getDocumentsFromCompositeSwagger(compositeSpecPath: any) {
  let compositeSwagger;
  let finalDocs: any = [];
  return utils.parseJson(compositeSpecPath).then(function (result: any) {
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
  }).catch(function (err: any) {
    log.error(err);
    return Promise.reject(err);
  });
};

export function validateSpec(specPath: any, options: any) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  // As a part of resolving discriminators we replace all the parent references
  // with a oneof array containing references to the parent and its children.
  // This breaks the swagger specification 2.0 schema since oneOf is not supported.
  // Hence we disable it since it is not required for semantic check.

  options.shouldResolveDiscriminator = false;
  // parameters in 'x-ms-parameterized-host' extension need not be resolved for semantic
  // validation as that would not match the path parameters defined in the path template
  // and cause the semantic validation to fail.
  options.shouldResolveParameterizedHost = false;

  // We shoudln't be resolving nullable types for semantic validaiton as we'll replace nodes
  // with oneof arrays which are not semantically valid in swagger 2.0 schema.
  options.shouldResolveNullableTypes = false;
  let validator = new SpecValidator(specPath, null, options);
  finalValidationResult[specPath] = validator.specValidationResult;
  return validator.initialize().then(function () {
    log.info(`Semantically validating  ${specPath}:\n`);
    return validator.validateSpec().then(function (result: any) {
      updateEndResultOfSingleValidation(validator);
      logDetailedInfo(validator);
      return Promise.resolve(validator.specValidationResult);
    });
  }).catch(function (err: any) {
    log.error(err);
    return Promise.reject(err);
  });
};

export function validateCompositeSpec(compositeSpecPath: any, options: any) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  return getDocumentsFromCompositeSwagger(compositeSpecPath).then(function (docs: any) {
    options.consoleLogLevel = log.consoleLogLevel;
    options.logFilepath = log.filepath;
    let promiseFactories = docs.map(function (doc: any) {
      return function () { return validateSpec(doc, options); };
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err: any) {
    log.error(err);
    return Promise.reject(err);
  });
};

export function validateExamples(specPath: any, operationIds: any, options?: any) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  let validator = new SpecValidator(specPath, null, options);
  finalValidationResult[specPath] = validator.specValidationResult;
  return validator.initialize().then(function () {
    log.info(`Validating "examples" and "x-ms-examples" in  ${specPath}:\n`);
    validator.validateOperations(operationIds);
    updateEndResultOfSingleValidation(validator);
    logDetailedInfo(validator);
    return Promise.resolve(validator.specValidationResult);
  }).catch(function (err: any) {
    log.error(err);
    return Promise.reject(err);
  });
};

export function validateExamplesInCompositeSpec(compositeSpecPath: any, options: any) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  return getDocumentsFromCompositeSwagger(compositeSpecPath).then(function (docs: any) {
    options.consoleLogLevel = log.consoleLogLevel;
    options.logFilepath = log.filepath;
    let promiseFactories = docs.map(function (doc: any) {
      return function () { return validateExamples(doc, options); };
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err: any) {
    log.error(err);
    return Promise.reject(err);
  });
};

export function resolveSpec(specPath: any, outputDir: any, options: any) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  let specFileName = path.basename(specPath);
  let resolver: any;
  return utils.parseJson(specPath).then((result: any) => {
    resolver = new SpecResolver(specPath, result, options);
    return resolver.resolve();
  }).then(() => {
    let resolvedSwagger = JSON.stringify(resolver.specInJson, null, 2);
    if (outputDir !== './' && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    let outputFilepath = `${path.join(outputDir, specFileName)}`;
    fs.writeFileSync(`${path.join(outputDir, specFileName)}`, resolvedSwagger, { encoding: 'utf8' });
    console.log(`Saved the resolved spec at "${outputFilepath}".`);
    return Promise.resolve();
  }).catch((err: any) => {
    log.error(err);
    return Promise.reject(err);
  });
};

export function resolveCompositeSpec(specPath: any, outputDir: any, options: any) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  return getDocumentsFromCompositeSwagger(specPath).then(function (docs: any) {
    options.consoleLogLevel = log.consoleLogLevel;
    options.logFilepath = log.filepath;
    let promiseFactories = docs.map(function (doc: any) {
      return function () { return resolveSpec(doc, outputDir, options); };
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err: any) {
    log.error(err);
    return Promise.reject(err);
  });
};


export function generateWireFormat(specPath: any, outDir: any, emitYaml: any, operationIds: any, options: any) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  let wfGenerator = new WireFormatGenerator(specPath, null, outDir, emitYaml);
  return wfGenerator.initialize().then(function () {
    log.info(`Generating wire format request and responses for swagger spec: "${specPath}":\n`);
    wfGenerator.processOperations(operationIds);
    return Promise.resolve();
  }).catch(function (err: any) {
    log.error(err);
    return Promise.reject(err);
  });
};

export function generateWireFormatInCompositeSpec(compositeSpecPath: any, outDir: any, emitYaml: any, options: any) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  return getDocumentsFromCompositeSwagger(compositeSpecPath).then(function (docs: any) {
    options.consoleLogLevel = log.consoleLogLevel;
    options.logFilepath = log.filepath;
    let promiseFactories = docs.map(function (doc: any) {
      return function () { return generateWireFormat(doc, outDir, emitYaml, null, options); };
    });
    return utils.executePromisesSequentially(promiseFactories);
  }).catch(function (err: any) {
    log.error(err);
    return Promise.reject(err);
  });
};

export function generateUml(specPath: any, outputDir: any, options?: any) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  let specFileName = path.basename(specPath);
  let resolver: any;
  let resolverOptions: any = {};
  resolverOptions.shouldResolveRelativePaths = true;
  resolverOptions.shouldResolveXmsExamples = false;
  resolverOptions.shouldResolveAllOf = false;
  resolverOptions.shouldSetAdditionalPropertiesFalse = false;
  resolverOptions.shouldResolvePureObjects = false;
  resolverOptions.shouldResolveDiscriminator = false;
  resolverOptions.shouldResolveParameterizedHost = false;
  resolverOptions.shouldResolveNullableTypes = false;
  return utils.parseJson(specPath).then((result: any) => {
    resolver = new SpecResolver(specPath, result, resolverOptions);
    return resolver.resolve();
  }).then(() => {
    let umlGenerator = new UmlGenerator(resolver.specInJson, options);
    return umlGenerator.generateDiagramFromGraph();
  }).then((svgGraph: any) => {
    if (outputDir !== './' && !fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir);
    }
    let svgFile = specFileName.replace(path.extname(specFileName), '.svg');
    let outputFilepath = `${path.join(outputDir, svgFile)}`;
    fs.writeFileSync(`${path.join(outputDir, svgFile)}`, svgGraph, { encoding: 'utf8' });
    console.log(`Saved the uml at "${outputFilepath}". Please open the file in a browser.`);
    return Promise.resolve();
  }).catch((err: any) => {
    log.error(err);
    return Promise.reject(err);
  });
};

export function updateEndResultOfSingleValidation(validator: any) {
  if (validator.specValidationResult.validityStatus) {
    if (!(log.consoleLogLevel === 'json' || log.consoleLogLevel === 'off')) {
      log.info('No Errors were found.');
    }
  }
  if (!validator.specValidationResult.validityStatus) {
    process.exitCode = 1;
    finalValidationResult.validityStatus = validator.specValidationResult.validityStatus;
  }
  return;
};

export function logDetailedInfo(validator: any) {
  if (log.consoleLogLevel === 'json') {
    console.dir(validator.specValidationResult, { depth: null, colors: true });
  }
  log.silly('############################');
  log.silly(validator.specValidationResult);
  log.silly('----------------------------');
};

export function extractXMsExamples(specPath: any, recordings: any, options: any) {
  if (!options) options = {};
  log.consoleLogLevel = options.consoleLogLevel || log.consoleLogLevel;
  log.filepath = options.logFilepath || log.filepath;
  let xMsExampleExtractor = new XMsExampleExtractor(specPath, recordings, options);
  return xMsExampleExtractor.extract();
};
