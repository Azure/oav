// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';
var util = require('util'),
  ExecutionEngine = require('../executionEngine'),
  log = require('../util/logging'),
  validate = require('../../validate');

// exports.command = 'live-test <spec-path>';

// exports.describe = 'Performs live testing of x-ms-examples provided for operations in the spec. ' + 
//   'This command will be making live calls to the service that is described in the given swagger spec.';

// exports.builder = {
//   o: {
//     alias: 'operationIds',
//     describe: 'A comma separated string of operationIds for which the examples ' + 
//     'need to be validated. If operationIds are not provided then the entire spec will be validated. ' + 
//     'Example: "StorageAccounts_Create, StorageAccounts_List, Usages_List".',
//     string: true
//   }
// };

// exports.handler = function (argv) {
//   log.debug(argv);
//   let specPath = argv.specPath;
//   let operationIds = argv.operationIds;
//   if (specPath.match(/.*composite.*/ig) !== null) {
//     return validate.validateExamplesInCompositeSpec(specPath);
//   } else {
//     return new ExecutionEngine().liveTest(specPath, operationIds);
//   }
// }

// exports = module.exports;