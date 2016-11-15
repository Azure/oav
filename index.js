// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var glob = require('glob'),
path = require('path'),
async = require('async'),
globPath = path.join(__dirname, '/**/swagger/*.json'),
SpecValidator = require('./lib/specValidator'),
finalValidationResult = {};

var swaggers = glob.sync(globPath).filter(function (entry) {
  if (entry.match(/.*arm-storage\/2016-01-01\/swagger.*/ig) !== null ||
      entry.match(/.*arm-search\/2015-08-19\/swagger.*/ig) !== null ||
      entry.match(/.*arm-mediaservices\/2015-10-01\/swagger.*/ig) !== null) {
    return entry;
  }
});

async.eachSeries(swaggers, function (spec, callback) {
  let specValidator = new SpecValidator(spec);
  finalValidationResult[spec] = specValidator.specValidationResult;
  console.log(`\n> Validating DataModels in ${spec}:\n`);
  specValidator.validateDataModels(function (err, result) {
    return callback(null);
  });
}, function (err) {
  if (err) {
    console.log(err);
  }
  console.log('\n> Final Validation Result object:\n')
  console.dir(finalValidationResult, { depth: null, colors: true });
  console.log('\n> Validated DataModels in all the requested specs.');
});

exports = module.exports;