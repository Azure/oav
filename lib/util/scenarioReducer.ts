// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { processValidationErrors, ValidationResult } from "./validationError"
import { toModelErrors } from "./toModelErrors"
import { ValidationResultSource } from "./validationResultSource"
import { responseReducer, Scenario } from "./responseReducer"
import { ModelValidationError } from "./modelValidationError"
import { Unknown } from "./unknown"
import { CommonError } from "./error"

export interface Result {
  isValid?: Unknown
  error?: CommonError
  warning?: Unknown
  result?: Unknown
  errors?: Unknown
  warnings?: Unknown
}

/*
export interface OperationExampleResult {
  isValid?: Unknown
  scenarios?: {
    [key in string]?: Scenario
  }
  request?: Result
  responses?: {
    [name: string]: Result
  }
  error?: Unknown
}
*/

export type OperationExampleResult = Scenario

export interface OperationResult {
  [key: string]: OperationExampleResult
}

export function scenarioReducer(
  acc: ModelValidationError[],
  scenarioName: string,
  operationId: string,
  operation: OperationResult
) {
  const example = operation["x-ms-examples"]
  if (example === undefined) {
    throw new Error("example is undefined")
  }
  const scenarios = example.scenarios
  if (scenarios === undefined) {
    throw new Error("scenarios is undefined")
  }
  const scenario = scenarios[scenarioName];
  if (scenario === undefined) {
    throw new Error("scenario is undefined")
  }
  const request = scenario.request
  if (request === undefined) {
    throw new Error("request is undefined")
  }
  const rawValidationResult: ValidationResult<ModelValidationError> = {
    requestValidationResult: {
      errors: request.error ? request.error.innerErrors : []
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
  if (!request.isValid) {
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
