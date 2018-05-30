// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as validate from './lib/validate'
import * as utils from './lib/util/utils'

// Easy to use methods from validate.js
export const getDocumentsFromCompositeSwagger = validate.getDocumentsFromCompositeSwagger
export const validateSpec = validate.validateSpec
export const validateCompositeSpec = validate.validateCompositeSpec
export const validateExamples = validate.validateExamples
export let validateExamplesInCompositeSpec = validate.validateExamplesInCompositeSpec
export { log } from './lib/util/logging'
export const executePromisesSequentially = utils.executePromisesSequentially
export const resolveSpec = validate.resolveSpec
export const resolveCompositeSpec = validate.resolveCompositeSpec

// Classes
export { SpecValidator } from './lib/validators/specValidator'
export { LiveValidator } from './lib/validators/liveValidator'
export { SpecResolver } from './lib/validators/specResolver'

// Constants
export { Constants } from './lib/util/constants'
