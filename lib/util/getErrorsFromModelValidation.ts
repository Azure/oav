// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { ModelValidationError } from "./modelValidationError"
import { operationReducer } from "./operationReducer"
import { OperationResult } from "./scenarioReducer"
import * as sm from "@ts-common/string-map"
import * as it from "@ts-common/iterator"

export interface ModelValidation {
  operations: {
    [key: string]: OperationResult|undefined
  }
}

/**
 * From the raw validator engine results process errors to be served.
 */
export function getErrorsFromModelValidation(
  validationResult: ModelValidation
): ReadonlyArray<ModelValidationError> {
  if (!validationResult.operations) {
    return [];
  }

  const operations = it.filterMap(
    sm.entries(validationResult.operations),
    ([operationId, operation]) => {
      const examples = operation["x-ms-examples"]
      if (examples === undefined) {
        return undefined
      }
      const scenarios = examples.scenarios
      if (scenarios === undefined) {
        return undefined
      }
      return { operationId, operation, scenarios }
    })
  return it.fold(operations, operationReducer, [])
}
