// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var glob = require('glob'),
path = require('path'),
SpecValidator = require('./lib/specValidator'),
RefParser = require('json-schema-ref-parser'),
swt = require('swagger-tools').specs.v2,
finalValidationResult = {};

var cmd = process.argv[2];
exports.printUsage = function printUsage() {
  console.log('');
  console.log('Usage: node validate.js <command> <spec-path> [--json]\n');
  console.log('Commands:\n');
  console.log('  - spec <raw-github-url OR local file-path to the swagger spec> [--json]    | Description: Performs semantic validation of the spec.\n')
  console.log('  - example <raw-github-url OR local file-path to the swagger spec> [--json] | Description: Performs validation of x-ms-examples and examples present in the spec.')
  console.log('\nOptions:\n  --json - Provides the json object with detailed status report.\n')
  process.exit(1);
}

if (cmd === '-h' || cmd === '--help' || cmd === 'help') {
  exports.printUsage();
}

var specPath = process.argv[3];
var jsonOutput = process.argv[4];
if (cmd !== 'spec' && cmd !== 'example') {
  if (cmd) console.error(`${cmd} is not a valid command.`)
  exports.printUsage();
}
if (!specPath || (specPath && typeof specPath.valueOf() !== 'string')) {
  console.error(`<spec-path> (raw-github url or a local file path to the swagger spec) is required and must be of type string.`);
  exports.printUsage();
}
//If the spec path is a url starting with https://github then let us auto convert it to an https://raw.githubusercontent url.
if (specPath.startsWith('https://github')) {
  console.warn('Warning: Converting the github url to raw github user content url.');
  specPath = specPath.replace(/^https:\/\/(github.com)(.*)blob\/(.*)/ig, 'https://raw.githubusercontent.com$2$3');
}

function printResult(validator) {
  if (jsonOutput && jsonOutput === '--json') {
    console.log('\n> Detailed Validation Result:\n')
    console.dir(finalValidationResult, { depth: null, colors: true });
  }
  if (validator.specValidationResult.validityStatus) console.log('\n> No Errors were found.');
  console.log('\n> Validation Complete.');
}

var validator;
if (cmd === 'example') {
  console.log(`\n> Validating "examples" and "x-ms-examples" in ${specPath}:\n`);
  validator = new SpecValidator(specPath);
  finalValidationResult[specPath] = validator.specValidationResult;
  validator.validateDataModels(function (err, result) {
    printResult(validator);
    if (!validator.specValidationResult.validityStatus) process.exit(3);
    return;
  });
} else if (cmd === 'spec') {
  console.log(`\n> Semantically validating  ${specPath}:\n`);
  validator = new SpecValidator(specPath);
  finalValidationResult[specPath] = validator.specValidationResult;
  validator.validateSpec(function (err, result) {
    printResult(validator);
    if (!validator.specValidationResult.validityStatus) process.exit(2);
    return;
  });
}

exports = module.exports;
