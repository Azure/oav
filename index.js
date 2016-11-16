// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var glob = require('glob'),
path = require('path'),
async = require('async'),
globPath = path.join(__dirname, '/**/swagger/*.json'),
SpecValidator = require('./lib/specValidator'),
RefParser = require('json-schema-ref-parser'),
swt = require('swagger-tools').specs.v2,
finalValidationResult = {};

var swaggers = glob.sync(globPath).filter(function (entry) {
  if (entry.match(/.*arm-storage\/2016-01-01\/swagger.*/ig) !== null ||
      entry.match(/.*arm-search\/2015-08-19\/swagger.*/ig) !== null ||
      entry.match(/.*arm-mediaservices\/2015-10-01\/swagger.*/ig) !== null) {
    return entry;
  }
});

//async.eachSeries(swaggers, function (spec, callback) {
//  let specValidator = new SpecValidator(spec);
//  finalValidationResult[spec] = specValidator.specValidationResult;
//  console.log(`\n> Validating DataModels in ${spec}:\n`);
//  specValidator.validateDataModels(function (err, result) {
//    return callback(null);
//  });
//}, function (err) {
//  if (err) {
//    console.log(err);
//  }
//  console.log('\n> Final Validation Result object:\n')
//  console.dir(finalValidationResult, { depth: null, colors: true });
//  console.log('\n> Validated DataModels in all the requested specs.');
//});
function specValidator(parsedSpecInJson, callback) {
  swt.validate(parsedSpecInJson, function (err, result) {
    if (err) {
      callback(err);
    }
    if (result && result.errors.length > 0) {
      console.log('');
      console.log('Errors');
      console.log('------');

      result.errors.forEach(function (err) {
        if (err.path[0] === 'paths') {
          err.path.shift();
          console.log(err.code + ' : ' + err.path.join('/') + ' : ' + err.message);
        } else {
          console.log(err.code + ' : ' + '#/' + err.path.join('/') + ' : ' + err.message);
        }
      });
      callback(new Error(util.inspect(result.errors, { depth: null })));
    } else {
      callback();
    }
  });
}

let mySchema = 'https://raw.githubusercontent.com/Azure/azure-rest-api-specs/master/arm-network/2016-09-01/swagger/network.json';
RefParser.bundle(mySchema, function (err, api) {
  if (err) {
    console.log(err);
  }
  else {
    //console.log(api);
    specValidator(api, function (err, result) {
      if (err) {
        console.log(err);
      } else {
        console.log(result);
      }
    });
  }
});

exports = module.exports;