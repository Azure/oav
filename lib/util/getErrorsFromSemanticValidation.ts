import { SpecValidationResult } from "../validators/specValidator"

import { BaseValidationError } from "./baseValidationError"
import {
  errorCodeToErrorMetadata,
  NodeError,
  serializeErrors,
  serializeErrorsForUnifiedPipeline
} from "./validationError"
import { ValidationResultSource } from "./validationResultSource"

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

  return validationResult.validateSpec.errors.reduce((acc, rawError) => {
    const serializedErrors: any[] = serializeErrors(rawError.inner || rawError, [])

    // process serialized errors
    const semanticErrors: SemanticValidationError[] = serializedErrors.map(serializedError => {
      const severity = errorCodeToErrorMetadata(serializedError.code).severity
      const semanticError: SemanticValidationError = {
        source: ValidationResultSource.GLOBAL,
        code: serializedError.code,
        details: serializedError,
        path: rawError["json-path"],
        severity
      }
      return semanticError
    })
    return [...acc, ...semanticErrors]
  }, new Array<SemanticValidationError>())
}

/**
 * From the raw validator engine semantic validation results process errors to be served.
 * This function is used only for unified pipeline that would serialize all errors
 */
export const getErrorsFromSemanticValidationForUnifiedPipeline = (
  validationResult: SpecValidationResult & ValidationResult
): SemanticValidationError[] => {
  if (!validationResult.validateSpec || !validationResult.validateSpec.errors) {
    return []
  }

  return validationResult.validateSpec.errors
    .reduce((acc, rawError) => {
      const serializedErrors: any[] = serializeErrorsForUnifiedPipeline(
        rawError.inner || rawError,
        []
      )

      // process serialized errors
      const semanticErrors: SemanticValidationError[] = serializedErrors.map(serializedError => {
        const severity = errorCodeToErrorMetadata(serializedError.code).severity
        const semanticError: SemanticValidationError = {
          source: ValidationResultSource.GLOBAL,
          code: serializedError.code,
          details: serializedError,
          path: rawError["json-path"],
          severity
        }
        return semanticError
      })
      return [...acc, ...semanticErrors]
    }, new Array<SemanticValidationError>())
    .filter(
      it =>
        it.code !== "ANY_OF_MISSING" &&
        it.code !== "ONE_OF_MISSING" &&
        it.code !== "ONE_OF_MULTIPLE"
    )
}
