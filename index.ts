// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import * as C from "./lib/util/constants"

// Easy to use methods from validate.ts
export {
  getDocumentsFromCompositeSwagger,
  validateSpec,
  validateCompositeSpec,
  validateExamples,
  validateExamplesInCompositeSpec,
  resolveSpec,
  resolveCompositeSpec
} from "./lib/validate"

export { CommonError } from "./lib/util/commonError"
export { BaseValidationError } from "./lib/util/baseValidationError"
export { Severity } from "./lib/util/severity"
export { ModelValidationError } from "./lib/util/modelValidationError"
export { ValidationResultSource } from "./lib/util/validationResultSource"
export { getErrorsFromModelValidation } from "./lib/util/getErrorsFromModelValidation"
export {
  getErrorsFromSemanticValidation,
  getErrorsFromSemanticValidationForUnifiedPipeline,
  SemanticValidationError
} from "./lib/util/getErrorsFromSemanticValidation"
export {
  NodeError,
  ValidationErrorMetadata,
  errorCodeToErrorMetadata,
  ValidationResult,
  ErrorCode,
  ExtendedErrorCode,
  WrapperErrorCode,
  RuntimeErrorCode
} from "./lib/util/validationError"

export { getResourceType, getProvider } from "./lib/util/utils"

// Classes
export { SpecValidator } from "./lib/validators/specValidator"
export { ModelValidator } from "./lib/validators/modelValidator"
export { SemanticValidator } from "./lib/validators/semanticValidator"
export {
  LiveValidator,
  RequestResponsePair,
  LiveRequest,
  LiveResponse,
  LiveValidationIssue,
  LiveValidatorOptions,
  ApiOperationIdentifier,
  RequestResponseLiveValidationResult,
  LiveValidationResult,
  ValidateOptions,
  ValidationRequest
} from "./lib/validators/liveValidator"
export { SpecResolver } from "./lib/validators/specResolver"
export { log } from "./lib/util/logging"

// Constants
export const Constants = C
