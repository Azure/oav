// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import validate = require('./lib/validate')
import utils = require('./lib/util/utils')

// Easy to use methods from validate.js
export let getDocumentsFromCompositeSwagger = validate.getDocumentsFromCompositeSwagger;
export let validateSpec = validate.validateSpec;
export let validateCompositeSpec = validate.validateCompositeSpec;
export let validateExamples = validate.validateExamples;
export let validateExamplesInCompositeSpec = validate.validateExamplesInCompositeSpec;
export { log } from './lib/util/logging'
export let executePromisesSequentially = utils.executePromisesSequentially;
export let resolveSpec = validate.resolveSpec;
export let resolveCompositeSpec = validate.resolveCompositeSpec;

// Classes
export let Validator = require('./lib/validators/specValidator');
export let LiveValidator = require('./lib/validators/liveValidator');
export let SpecResolver = require('./lib/validators/specResolver');

// Constants
export let Constants = require('./lib/util/constants');
