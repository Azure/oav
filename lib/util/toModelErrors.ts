import { IterableEx, map } from "@azure-tools/openapi-tools-common";

import { ModelValidationError } from "./modelValidationError.js";
import { errorCodeToErrorMetadata, ExtendedErrorCode } from "./validationError.js";
import { ValidationResultSource } from "./validationResultSource.js";

/**
 * Transforms serialized errors to ModelValidationError
 */
export function toModelErrors(
  processedErrors: Iterable<ModelValidationError>,
  operationId: string,
  scenario: string,
  source: ValidationResultSource,
  responseCode: string
): IterableEx<ModelValidationError> {
  return map(processedErrors, (value) => {
    if (value.code === undefined) {
      value.code = "INTERNAL_ERROR";
    }
    const severity = errorCodeToErrorMetadata(value.code as ExtendedErrorCode).severity;
    const modelError: ModelValidationError = {
      operationId,
      scenario,
      source,
      responseCode,
      severity,
      code: value.code,
      details: value,
    };
    return modelError;
  });
}
