import { ModelValidationError } from "./modelValidationError"
import { errorCodeToSeverity } from "./validationError"
import { ValidationResultSource } from "./validationResultSource"
import { SerializedError } from "./baseValidationError"

/**
 * Transforms serialized errors to ModelValidationError
 */
export function toModelErrors(
  processedErrors: ReadonlyArray<ModelValidationError>,
  operationId: string,
  scenario: string,
  source: ValidationResultSource,
  responseCode: string
): ReadonlyArray<ModelValidationError> {
  return processedErrors.map(value => {
    if (value.code === undefined) {
      throw Error("value.code is undefined")
    }
    const severity = errorCodeToSeverity(value.code);
    const modelError: ModelValidationError = {
      operationId,
      scenario,
      source,
      responseCode,
      severity,
      errorCode: value.code,
      errorDetails: value as SerializedError,
    }
    return modelError
  })
}
