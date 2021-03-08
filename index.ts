// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import "reflect-metadata";
import * as C from "./lib/util/constants";

// Easy to use methods from validate.ts
export {
  getDocumentsFromCompositeSwagger,
  validateSpec,
  validateCompositeSpec,
  validateExamples,
  validateExamplesInCompositeSpec,
  resolveSpec,
  resolveCompositeSpec,
} from "./lib/validate";

export { BaseValidationError } from "./lib/util/baseValidationError";
export { Severity } from "./lib/util/severity";
export { ModelValidationError } from "./lib/util/modelValidationError";
export { ValidationResultSource } from "./lib/util/validationResultSource";
export { getErrorsFromModelValidation } from "./lib/util/getErrorsFromModelValidation";
export {
  getErrorsFromSemanticValidation,
  SemanticValidationError,
} from "./lib/util/getErrorsFromSemanticValidation";
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

// Classes
export { SpecValidator } from "./lib/validators/specValidator";
export {
  LiveValidator,
  RequestResponsePair,
  LiveValidationIssue,
  LiveValidatorOptions,
  RequestResponseLiveValidationResult,
  LiveValidationResult,
  ValidateOptions,
} from "./lib/liveValidation/liveValidator";
export { LiveRequest, LiveResponse } from "./lib/liveValidation/operationValidator";
export { SpecResolver } from "./lib/validators/specResolver";

export { TestResourceLoader } from "./lib/testScenario/testResourceLoader";
export {
  TestDefinitionFile,
  TestScenario,
  TestStep,
  TestStepArmTemplateDeployment,
  TestStepRestCall,
} from "./lib/testScenario/testResourceTypes";
export { VariableEnv } from "./lib/testScenario/variableEnv";
export {
  TestScenarioRunner,
  TestScenarioRunnerClient,
} from "./lib/testScenario/testScenarioRunner";

export { PostmanCollectionRunnerClient } from "./lib/testScenario/postmanCollectionRunnerClient";
export {
  PostmanCollectionGenerator,
  PostmanCollectionGeneratorOption,
} from "./lib/testScenario/postmanCollectionGenerator";

// Constants
export const Constants = C;
