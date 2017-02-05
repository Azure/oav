// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var validate = require('./validate');
var utils = require('./lib/util/utils');

exports.getDocumentsFromCompositeSwagger = validate.getDocumentsFromCompositeSwagger;
exports.validateSpec = validate.validateSpec;
exports.validateCompositeSpec = validate.validateCompositeSpec;
exports.validateExamples = validate.validateExamples;
exports.validateExamplesInCompositeSpec = validate.validateExamplesInCompositeSpec;
exports.Validator = require('./lib/specValidator');
exports.log = require('./lib/util/logging');
exports.executePromisesSequentially = utils.executePromisesSequentially;