// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { ModelValidationError } from "./modelValidationError"
import { operationReducer } from "./operationReducer"
import { OperationResult } from "./scenarioReducer"

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
): ModelValidationError[] {
  if (!validationResult.operations) {
    return [];
  }

  const operations = Object.entries(validationResult.operations)
    .filter(
      ([_, operation]) => {
        if (!operation) {
          return false
        }
        const examples = operation["x-ms-examples"]
        return examples && examples.scenarios
      }
    )
  return (operations as ReadonlyArray<[string, OperationResult]>).reduce(operationReducer, []);
}
