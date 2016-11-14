// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var glob = require('glob'),
path = require('path'),
globPath = path.join(__dirname, '/**/swagger/*.json'),
SpecValidator = require('./lib/specValidator'),
finalValidationResult = {};

var swaggers = glob.sync(globPath).filter(function (entry) {
  if (entry.match(/.*arm-storage\/2016-01-01\/swagger.*/ig) !== null) {
    return entry;
  }
});

swaggers.forEach(function (spec) {
  var specValidator = new SpecValidator(spec);
  finalValidationResult[spec] = specValidator.specValidationResult;
  specValidator.validateDataModels(function (err, result) {
    console.dir(finalValidationResult, { depth: null, colors: true });
  });
});

exports = module.exports;