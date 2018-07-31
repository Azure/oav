import { ModelValidationError } from "./modelValidationError"
import { errorCodeToSeverity } from "./validationError"
import { ValidationResultSource } from "./validationResultSource"
import { SerializedError } from "./baseValidationError"
import * as it from "@ts-common/iterator"

/**
 * Transforms serialized errors to ModelValidationError
 */
export function toModelErrors(
  processedErrors: Iterable<ModelValidationError>,
  operationId: string,
  scenario: string,
  source: ValidationResultSource,
  responseCode: string
): Iterable<ModelValidationError> {
  return it.map(processedErrors, value => {
    if (value.code === undefined) {
      throw Error("ICE: value.code is undefined")
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
