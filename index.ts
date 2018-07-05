// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as C from "./lib/util/constants"

// Easy to use methods from validate.ts
export {
  getDocumentsFromCompositeSwagger,
  validateSpec,
  validateCompositeSpec,
  validateExamples,
  validateExamplesInCompositeSpec,
  resolveSpec,
  resolveCompositeSpec,
} from "./lib/validate"

export { executePromisesSequentially } from "./lib/util/utils"

// export { log } from "./lib/util/logging"

// Classes
export { SpecValidator } from "./lib/validators/specValidator"
export { LiveValidator } from "./lib/validators/liveValidator"
export { SpecResolver } from "./lib/validators/specResolver"

// Constants
export const Constants = C
