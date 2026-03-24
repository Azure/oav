// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import "reflect-metadata";
import * as C from "./lib/util/constants.js";

// Easy to use methods from validate.ts
export {
  validateSpec,
  validateExamples,
  validateTraffic as validateTrafficAgainstSpec,
} from "./lib/validate.js";

export type { BaseValidationError } from "./lib/util/baseValidationError.js";
export { Severity } from "./lib/util/severity.js";
export type { ModelValidationError } from "./lib/util/modelValidationError.js";
export { ValidationResultSource } from "./lib/util/validationResultSource.js";
export { errorCodeToErrorMetadata } from "./lib/util/validationError.js";
export type {
  NodeError,
  ValidationErrorMetadata,
  ValidationResult,
  ErrorCode,
  ExtendedErrorCode,
  WrapperErrorCode,
  RuntimeErrorCode,
  RuntimeException,
} from "./lib/util/validationError.js";

export { getResourceType, getProvider } from "./lib/util/utils.js";

// Classes
export {
  LiveValidator,
  LiveValidatorLoggingTypes,
  legacyParseValidationRequest as parseValidationRequest,
} from "./lib/liveValidation/liveValidator.js";
export type {
  RequestResponsePair,
  LiveValidationIssue,
  LiveValidatorOptions,
  RequestResponseLiveValidationResult,
  LiveValidationResult,
  ValidateOptions,
} from "./lib/liveValidation/liveValidator.js";
export type {
  LiveRequest,
  LiveResponse,
  ValidationRequest,
} from "./lib/liveValidation/operationValidator.js";

export type {
  ScenarioDefinition,
  Scenario,
  Step,
  StepArmTemplate,
  StepRestCall,
} from "./lib/apiScenario/apiScenarioTypes.js";

export { FileLoader } from "./lib/swagger/fileLoader.js";
export type { FileLoaderOption } from "./lib/swagger/fileLoader.js";

export { SwaggerLoader } from "./lib/swagger/swaggerLoader.js";
export type { SwaggerLoaderOption } from "./lib/swagger/swaggerLoader.js";

export { SuppressionLoader } from "./lib/swagger/suppressionLoader.js";
export type { SuppressionLoaderOption } from "./lib/swagger/suppressionLoader.js";

export { JsonLoader, JsonLoaderRefError } from "./lib/swagger/jsonLoader.js";
export type { JsonLoaderOption } from "./lib/swagger/jsonLoader.js";

export {
  SwaggerExampleValidator,
  NewModelValidator,
} from "./lib/swaggerValidator/modelValidator.js";
export type {
  SwaggerExampleErrorDetail,
  ExampleValidationOption,
} from "./lib/swaggerValidator/modelValidator.js";

export {
  SwaggerSemanticValidator,
  SemanticValidator,
} from "./lib/swaggerValidator/semanticValidator.js";
export type {
  SemanticErrorDetail,
  SemanticValidationOption,
} from "./lib/swaggerValidator/semanticValidator.js";

export { TrafficValidator } from "./lib/swaggerValidator/trafficValidator.js";
export type { TrafficValidationIssue } from "./lib/swaggerValidator/trafficValidator.js";

// Constants
export const Constants = C;
