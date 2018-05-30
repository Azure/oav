// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as validate from './lib/validate'
import * as utils from './lib/util/utils'

// Easy to use methods from validate.js
export let getDocumentsFromCompositeSwagger = validate.getDocumentsFromCompositeSwagger
export let validateSpec = validate.validateSpec
export let validateCompositeSpec = validate.validateCompositeSpec
export let validateExamples = validate.validateExamples
export let validateExamplesInCompositeSpec = validate.validateExamplesInCompositeSpec
export { log } from './lib/util/logging'
export let executePromisesSequentially = utils.executePromisesSequentially
export let resolveSpec = validate.resolveSpec
export let resolveCompositeSpec = validate.resolveCompositeSpec

// Classes
export { SpecValidator } from './lib/validators/specValidator'
export { LiveValidator } from './lib/validators/liveValidator'
export { SpecResolver } from './lib/validators/specResolver'

// Constants
export { Constants } from './lib/util/constants'
