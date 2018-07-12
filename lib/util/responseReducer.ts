import { processValidationErrors, ValidationResult } from "./validationError"
import { toModelErrors } from "./toModelErrors"
import { ValidationResultSource } from "./validationResultSource"
import { Unknown } from "./unknown"
import { ModelValidationError } from "./modelValidationError"

export interface Result {
  readonly isValid: Unknown
  readonly error: {
    readonly innerErrors: ModelValidationError[]
  }
}

export interface Scenario {
  readonly request: Result
  readonly responses: {
    readonly [key in string|number]: Result
  }
}

export function responseReducer(
  responseAcc: Unknown[],
  responseCode: string,
  scenario: Scenario,
  rawValidationResult: ValidationResult<ModelValidationError>,
  operationId: string,
  scenarioName: string
) {
  const response = scenario.responses[responseCode]
  rawValidationResult.responseValidationResult.errors = response.error
    ? response.error.innerErrors
    : []

  const processedErrors = processValidationErrors(rawValidationResult)

  if (processedErrors.responseValidationResult.errors === undefined) {
    throw new Error("ICE: processedErrors.responseValidationResult.errors === undefined")
  }
  return [
    ...responseAcc,
    ...toModelErrors(
      processedErrors.responseValidationResult.errors,
      operationId,
      scenarioName,
      ValidationResultSource.RESPONSE,
      responseCode
    )
  ]
}
