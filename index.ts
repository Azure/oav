// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import "reflect-metadata";
import * as C from "./lib/util/constants";

// Easy to use methods from validate.ts
export {
  validateSpec,
  validateExamples,
  validateTraffic as validateTrafficAgainstSpec,
} from "./lib/validate";

export { BaseValidationError } from "./lib/util/baseValidationError";
export { Severity } from "./lib/util/severity";
export { ModelValidationError } from "./lib/util/modelValidationError";
export { ValidationResultSource } from "./lib/util/validationResultSource";
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
} from "./lib/util/validationError";

export { getResourceType, getProvider } from "./lib/util/utils";

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
} from "./lib/liveValidation/liveValidator";
export {
  LiveRequest,
  LiveResponse,
  ValidationRequest,
} from "./lib/liveValidation/operationValidator";

export { ApiScenarioLoader } from "./lib/apiScenario/apiScenarioLoader";
export {
  ScenarioDefinition,
  Scenario,
  Step,
  StepArmTemplate,
  StepRestCall,
} from "./lib/apiScenario/apiScenarioTypes";
export { VariableEnv } from "./lib/apiScenario/variableEnv";
export { ApiScenarioRunner, ApiScenarioRunnerClient } from "./lib/apiScenario/apiScenarioRunner";

export { FileLoaderOption, FileLoader } from "./lib/swagger/fileLoader";

export { SwaggerLoaderOption, SwaggerLoader } from "./lib/swagger/swaggerLoader";

export { SuppressionLoaderOption, SuppressionLoader } from "./lib/swagger/suppressionLoader";

export { JsonLoader, JsonLoaderOption, JsonLoaderRefError } from "./lib/swagger/jsonLoader";

export {
  SwaggerExampleErrorDetail,
  SwaggerExampleValidator,
  NewModelValidator,
  ExampleValidationOption,
} from "./lib/swaggerValidator/modelValidator";

export {
  SemanticErrorDetail,
  SwaggerSemanticValidator,
  SemanticValidationOption,
  SemanticValidator,
} from "./lib/swaggerValidator/semanticValidator";

export { TrafficValidationIssue, TrafficValidator } from "./lib/swaggerValidator/trafficValidator";

// Constants
export const Constants = C;
