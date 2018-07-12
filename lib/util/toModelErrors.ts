import { ModelValidationError } from "./modelValidationError"
import { errorCodeToSeverity } from "./validationError"
import { ValidationResultSource } from "./validationResultSource"

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
  return processedErrors.reduce((acc: any, value: any) => {
    const severity = errorCodeToSeverity(value.code);
    const modelError: ModelValidationError = {
      operationId,
      scenario,
      source,
      responseCode,
      severity,
      errorCode: value.code,
      errorDetails: value
    };
    return [...acc, modelError];
  }, []);
}
