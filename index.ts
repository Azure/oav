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

export { getResourceType, getProvider } from "./lib/util/utils";

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
  LiveValidatorLoggingTypes,
  parseValidationRequest,
} from "./lib/liveValidation/liveValidator";
export {
  LiveRequest,
  LiveResponse,
  ValidationRequest,
} from "./lib/liveValidation/operationValidator";
export { SpecResolver } from "./lib/validators/specResolver";

export { ApiScenarioLoader as TestResourceLoader } from "./lib/testScenario/apiScenarioLoader";
export {
  ScenarioDefinition as TestDefinitionFile,
  Scenario as TestScenario,
  Step as TestStep,
  StepArmTemplate as TestStepArmTemplateDeployment,
  StepRestCall as TestStepRestCall,
} from "./lib/testScenario/apiScenarioTypes";
export { VariableEnv } from "./lib/testScenario/variableEnv";
export {
  ApiScenarioRunner as TestScenarioRunner,
  ApiScenarioRunnerClient as TestScenarioRunnerClient,
} from "./lib/testScenario/apiScenarioRunner";

export { PostmanCollectionRunnerClient } from "./lib/testScenario/postmanCollectionRunnerClient";
export {
  PostmanCollectionGenerator,
  PostmanCollectionGeneratorOption,
} from "./lib/testScenario/postmanCollectionGenerator";
export {
  SwaggerAnalyzer,
  SwaggerAnalyzerOption,
  ExampleDependency,
  DependencyResult,
  normalizeDependency,
} from "./lib/testScenario/swaggerAnalyzer";

export { getAutorestConfig } from "./lib/util/getAutorestConfig";
// Constants
export const Constants = C;
