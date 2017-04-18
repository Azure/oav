// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var validate = require('./lib/validate');
var utils = require('./lib/util/utils');

// Easy to use methods from validate.js
exports.getDocumentsFromCompositeSwagger = validate.getDocumentsFromCompositeSwagger;
exports.validateSpec = validate.validateSpec;
exports.validateCompositeSpec = validate.validateCompositeSpec;
exports.validateExamples = validate.validateExamples;
exports.validateExamplesInCompositeSpec = validate.validateExamplesInCompositeSpec;
exports.log = require('./lib/util/logging');
exports.executePromisesSequentially = utils.executePromisesSequentially;
exports.resolveSpec = validate.resolveSpec;
exports.resolveCompositeSpec = validate.resolveCompositeSpec;

// Classes
exports.Validator = require('./lib/validators/specValidator');
exports.LiveValidator = require('./lib/validators/liveValidator');
exports.SpecResolver = require('./lib/validators/specResolver');