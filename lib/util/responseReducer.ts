// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { processValidationErrors, ValidationResult } from "./validationError"
import { toModelErrors } from "./toModelErrors"
import { ValidationResultSource } from "./validationResultSource"
import { ModelValidationError } from "./modelValidationError"
import { SwaggerObject } from "yasway"

export interface Result {
  isValid?: unknown
  error?: ModelValidationError
  warning?: unknown
  result?: unknown
}

export interface Scenarios {
  [key: string]: Scenario|undefined
}

export interface Scenario {
  isValid?: unknown
  scenarios?: Scenarios
  readonly request?: Result
  readonly responses?: {
    [key in string|number]: Result
  }
  error?: unknown
}

export function responseReducer(
  spec: SwaggerObject,
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

  const processedErrors = processValidationErrors(spec, rawValidationResult)

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
