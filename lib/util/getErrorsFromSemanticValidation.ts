import { BaseValidationError } from './baseValidationError';
import { ValidationResultSource } from './validationResultSource';
import { SpecValidationResult } from '../validators/specValidator';
import { NodeError, serializeErrors, errorCodeToSeverity } from './validationError';

export interface SemanticValidationError extends BaseValidationError<NodeError<any>> {
  source?: ValidationResultSource
  path?: string
  readonly inner?: {}
  readonly "json-path"?: string
}

interface ValidationResult {
  readonly validateSpec: {
    readonly errors: ReadonlyArray<SemanticValidationError>
  }
}

/**
 * From the raw validator engine semantic validation results process errors to be served.
 */
export const getErrorsFromSemanticValidation = (
  validationResult: SpecValidationResult & ValidationResult
): SemanticValidationError[] => {
  if (!validationResult.validateSpec || !validationResult.validateSpec.errors) {
    return []
  }

  return validationResult.validateSpec.errors.reduce(
    (acc, rawError) => {
      const serializedErrors: any[] = serializeErrors(
        rawError.inner || rawError,
        []
      )

      // process serialized errors
      const semanticErrors: SemanticValidationError[] = serializedErrors.map(
        serializedError => {
          const severity = errorCodeToSeverity(serializedError.code)
          const semanticError: SemanticValidationError = {
            source: ValidationResultSource.GLOBAL,
            errorCode: serializedError.code,
            errorDetails: serializedError,
            path: rawError["json-path"],
            severity
          }
          return semanticError
        }
      )
      return [...acc, ...semanticErrors]
    },
    new Array<SemanticValidationError>()
  )
}
