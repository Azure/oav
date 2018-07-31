// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { processValidationErrors, ValidationResult } from "./validationError"
import { toModelErrors } from "./toModelErrors"
import { ValidationResultSource } from "./validationResultSource"
import { responseReducer, Scenario } from "./responseReducer"
import { ModelValidationError } from "./modelValidationError"
import { Unknown } from "./unknown"
import { CommonError } from "./commonError"
import * as sm from "@ts-common/string-map"
import * as it from "@ts-common/iterator"

export interface Result {
  isValid?: Unknown
  error?: CommonError
  warning?: Unknown
  result?: Unknown
  errors?: Unknown
  warnings?: Unknown
}

export type OperationExampleResult = Scenario

export interface OperationResult {
  [key: string]: OperationExampleResult
}

export function scenarioReducer(
  acc: ReadonlyArray<ModelValidationError>,
  scenarioName: string,
  scenario: Scenario,
  operationId: string,
): ReadonlyArray<ModelValidationError> {
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
  const modelErrors = !request.isValid
    ? toModelErrors(
      processedErrors.requestValidationResult.errors,
      operationId,
      scenarioName,
      ValidationResultSource.REQUEST,
      "ALL"
    ) : []

  // process responses
  rawValidationResult.requestValidationResult.errors = [];

  const responses = scenario.responses
  if (responses === undefined) {
    throw new Error("ICE: responses is undefined")
  }

  const entries = sm.entries(responses)
  const invalidResponses = it.filter(entries, ([_, response]) => !response.isValid)
  const result = it.flatMap(invalidResponses, ([responseCode]) => responseReducer(
    responseCode,
    scenario,
    rawValidationResult,
    operationId,
    scenarioName
  ))
  return [...acc, ...modelErrors, ...result]
}
