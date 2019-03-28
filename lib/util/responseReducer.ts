// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { MutableStringMap } from "@ts-common/string-map"

import { ModelValidationError } from "./modelValidationError"
import { toModelErrors } from "./toModelErrors"
import { processValidationResult, ValidationResult } from "./validationError"
import { ValidationResultSource } from "./validationResultSource"

export interface Result {
  isValid?: unknown
  error?: ModelValidationError
  warning?: unknown
  result?: unknown
}

export interface Scenario {
  isValid?: unknown
  readonly request?: Result
  readonly responses?: { [key in string | number]: Result }
  error?: unknown
}

export type Scenarios = MutableStringMap<Scenario>

export interface MultipleScenarios {
  scenarios?: Scenarios
  error?: unknown
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

  const processedErrors = processValidationResult(rawValidationResult)

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
