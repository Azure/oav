// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { processValidationErrors, ValidationResult } from "./validationError"
import { toModelErrors } from "./toModelErrors"
import { ValidationResultSource } from "./validationResultSource"
import { Unknown } from "./unknown"
import { ModelValidationError } from "./modelValidationError"

export interface Result {
  isValid?: Unknown
  error?: ModelValidationError
  warning?: Unknown
  result?: Unknown
}

export interface Scenarios {
  [key: string]: Scenario|undefined
}

export interface Scenario {
  isValid?: Unknown
  scenarios?: Scenarios
  readonly request?: Result
  readonly responses?: {
    [key in string|number]: Result
  }
  error?: Unknown
}

export function responseReducer(
  responseCode: string,
  scenario: Scenario,
  rawValidationResult: ValidationResult<ModelValidationError>,
  operationId: string,
  scenarioName: string
): Iterable<ModelValidationError> {
  if (scenario.responses === undefined) {
    throw new Error("ICE: scenario.responses is undefined")
  }
  const response = scenario.responses[responseCode]
  rawValidationResult.responseValidationResult.errors = response.error
    ? response.error.innerErrors
    : []

  const processedErrors = processValidationErrors(rawValidationResult)

  if (processedErrors.responseValidationResult.errors === undefined) {
    throw new Error("ICE: processedErrors.responseValidationResult.errors === undefined")
  }
  return toModelErrors(
    processedErrors.responseValidationResult.errors,
    operationId,
    scenarioName,
    ValidationResultSource.RESPONSE,
    responseCode
  )
}
