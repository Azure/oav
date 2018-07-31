import { ModelValidationError } from "./modelValidationError"
import { errorCodeToSeverity } from "./validationError"
import { ValidationResultSource } from "./validationResultSource"
import { SerializedError } from "./baseValidationError"

/**
 * Transforms serialized errors to ModelValidationError
 */
export function toModelErrors(
  processedErrors: ModelValidationError[],
  operationId: string,
  scenario: string,
  source: ValidationResultSource,
  responseCode: string
): ModelValidationError[] {
  return processedErrors.reduce((acc: ModelValidationError[], value: ModelValidationError) => {
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
    };
    return [...acc, modelError];
  }, []);
}
