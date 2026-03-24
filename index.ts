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

export { BaseValidationError } from "./lib/util/baseValidationError.js";
export { Severity } from "./lib/util/severity.js";
export { ModelValidationError } from "./lib/util/modelValidationError.js";
export { ValidationResultSource } from "./lib/util/validationResultSource.js";
export {
  NodeError,
  ValidationErrorMetadata,
  errorCodeToErrorMetadata,
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
  RequestResponsePair,
  LiveValidationIssue,
  LiveValidatorOptions,
  RequestResponseLiveValidationResult,
  LiveValidationResult,
  ValidateOptions,
  LiveValidatorLoggingTypes,
  legacyParseValidationRequest as parseValidationRequest,
} from "./lib/liveValidation/liveValidator.js";
export {
  LiveRequest,
  LiveResponse,
  ValidationRequest,
} from "./lib/liveValidation/operationValidator.js";

export {
  ScenarioDefinition,
  Scenario,
  Step,
  StepArmTemplate,
  StepRestCall,
} from "./lib/apiScenario/apiScenarioTypes.js";

export { FileLoaderOption, FileLoader } from "./lib/swagger/fileLoader.js";

export { SwaggerLoaderOption, SwaggerLoader } from "./lib/swagger/swaggerLoader.js";

export { SuppressionLoaderOption, SuppressionLoader } from "./lib/swagger/suppressionLoader.js";

export { JsonLoader, JsonLoaderOption, JsonLoaderRefError } from "./lib/swagger/jsonLoader.js";

export {
  SwaggerExampleErrorDetail,
  SwaggerExampleValidator,
  NewModelValidator,
  ExampleValidationOption,
} from "./lib/swaggerValidator/modelValidator.js";

export {
  SemanticErrorDetail,
  SwaggerSemanticValidator,
  SemanticValidationOption,
  SemanticValidator,
} from "./lib/swaggerValidator/semanticValidator.js";

export { TrafficValidationIssue, TrafficValidator } from "./lib/swaggerValidator/trafficValidator.js";

// Constants
export const Constants = C;
