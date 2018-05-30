// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

var util = require('util'),
  log = require('../util/logging'),
  validate = require('../validate');

exports.command = 'validate-spec <spec-path>';

exports.describe = 'Performs semantic validation of the spec.';

exports.handler = function (argv: any) {
  log.debug(argv);
  let specPath = argv.specPath;
  let vOptions: any = {};
  vOptions.consoleLogLevel = argv.logLevel;
  vOptions.logFilepath = argv.f;

  if (specPath.match(/.*composite.*/ig) !== null) {
    return validate.validateCompositeSpec(specPath, vOptions);
  } else {
    return validate.validateSpec(specPath, vOptions);
  }
};

exports = module.exports;