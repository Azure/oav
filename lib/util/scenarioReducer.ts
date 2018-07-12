// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { processValidationErrors, ValidationResult } from "./validationError"
import { toModelErrors } from "./toModelErrors"
import { ValidationResultSource } from "./validationResultSource"
import { responseReducer, Scenario } from "./responseReducer"
import { Unknown } from "./unknown"
import { ModelValidationError } from "./modelValidationError"

interface Operation {
  readonly ["x-ms-examples"]: {
    readonly scenarios: {
      readonly [key in string]: Scenario
    }
  }
}

export function scenarioReducer(
  acc: Unknown[], scenarioName: string, operationId: string, operation: Operation
) {
  const scenario = operation["x-ms-examples"].scenarios[scenarioName];
  const rawValidationResult: ValidationResult<ModelValidationError> = {
    requestValidationResult: {
      errors: scenario.request.error ? scenario.request.error.innerErrors : []
    },
    responseValidationResult: {
      errors: []
    }
  };
  // process request separately since its unique
  const processedErrors = processValidationErrors(rawValidationResult);

  if (processedErrors.requestValidationResult.errors === undefined) {
    throw new Error("ICE: processedErrors.requestValidationResult.errors === undefined")
  }
  if (!scenario.request.isValid) {
    acc = [
      ...acc,
      ...toModelErrors(
        processedErrors.requestValidationResult.errors,
        operationId,
        scenarioName,
        ValidationResultSource.REQUEST,
        "ALL"
      )
    ];
  }

  // process responses
  rawValidationResult.requestValidationResult.errors = [];

  return Object.keys(scenario.responses)
    .filter(responseCode => {
      const response = scenario.responses[responseCode];
      return !response.isValid;
    })
    .reduce(
      (responseAcc, responseCode) =>
        responseReducer(
          responseAcc,
          responseCode,
          scenario,
          rawValidationResult,
          operationId,
          scenarioName
        ),
      acc
    )
}
