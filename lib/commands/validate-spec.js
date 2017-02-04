// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';
var util = require('util'),
  log = require('../util/logging'),
  validate = require('../../validate');

exports.command = 'validate-spec <spec-path>';

exports.describe = 'Performs semantic validation of the spec.';

exports.handler = function (argv) {
  log.debug(argv);
  let specPath = argv.specPath;
  let json = argv.json;
  if (specPath.match(/.*composite.*/ig) !== null) {
    return validate.validateCompositeSpec(specPath, json);
  } else {
    return validate.validateSpec(specPath, json);
  }
};

exports = module.exports;