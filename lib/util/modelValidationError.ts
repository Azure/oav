import { BaseValidationError } from "./baseValidationError"
import { NodeError } from "./validationError"

export interface ModelValidationError extends BaseValidationError, NodeError<ModelValidationError> {
  operationId?: string
  scenario?: string
  responseCode?: string
}
