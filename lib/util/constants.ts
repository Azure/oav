// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

export const Constants = {
  constraints: ['minLength', 'maxLength', 'minimum', 'maximum', 'enum', 'maxItems', 'minItems', 'uniqueItems', 'multipleOf', 'pattern'],
  xmsExamples: 'x-ms-examples',
  exampleInSpec: 'example-in-spec',
  BodyParameterValid: 'BODY_PARAMETER_VALID',
  xmsSkipUrlEncoding: 'x-ms-skip-url-encoding',
  xmsParameterizedHost: 'x-ms-parameterized-host',
  Errors: 'Errors',
  Warnings: 'Warnings',
  ErrorCodes: {
    InternalError: { name: 'INTERNAL_ERROR', id: 'OAV100' },
    InitializationError: { name: 'INITIALIZATION_ERROR', id: 'OAV101' },
    ResolveSpecError: { name: 'RESOLVE_SPEC_ERROR', id: 'OAV102' },
    RefNotFoundError: { name: 'REF_NOTFOUND_ERROR', id: 'OAV103' },
    JsonParsingError: { name: 'JSON_PARSING_ERROR', id: 'OAV104' },
    RequiredParameterExampleNotFound: { name: 'REQUIRED_PARAMETER_EXAMPLE_NOT_FOUND', id: 'OAV105' },
    ErrorInPreparingRequest: { name: 'ERROR_IN_PREPARING_REQUEST', id: 'OAV106' },
    XmsExampleNotFoundError: { name: 'X-MS-EXAMPLE_NOTFOUND_ERROR', id: 'OAV107' },
    ResponseValidationError: { name: 'RESPONSE_VALIDATION_ERROR', id: 'OAV108' },
    RequestValidationError: { name: 'REQUEST_VALIDATION_ERROR', id: 'OAV109' },
    ResponseBodyValidationError: { name: 'RESPONSE_BODY_VALIDATION_ERROR', id: 'OAV110' },
    ResponseStatusCodeNotInExample: { name: 'RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE', id: 'OAV111' },
    ResponseStatusCodeNotInSpec: { name: 'RESPONSE_STATUS_CODE_NOT_IN_SPEC', id: 'OAV112' },
    ResponseSchemaNotInSpec: { nam: 'RESPONSE_SCHEMA_NOT_IN_SPEC', id: 'OAV113' },
    RequiredParameterNotInExampleError: { name: 'REQUIRED_PARAMETER_NOT_IN_EXAMPLE_ERROR', id: 'OAV114' },
    BodyParameterValidationError: { name: 'BODY_PARAMETER_VALIDATION_ERROR', id: 'OAV115' },
    TypeValidationError: { name: 'TYPE_VALIDATION_ERROR', id: 'OAV116' },
    ConstraintValidationError: { name: 'CONSTRAINT_VALIDATION_ERROR', id: 'OAV117' },
    StatuscodeNotInExampleError: { name: 'STATUS_CODE_NOT_IN_EXAMPLE_ERROR', id: 'OAV118' },
    SemanticValidationError: { name: 'SEMANTIC_VALIDATION_ERROR', id: 'OAV119' },
    MultipleOperationsFound: { name: 'MULTIPLE_OPERATIONS_FOUND', id: 'OAV120' },
    NoOperationFound: { name: 'NO_OPERATION_FOUND', id: 'OAV121' },
    IncorrectInput: { name: 'INCORRECT_INPUT', id: 'OAV122' },
    PotentialOperationSearchError: { name: 'POTENTIAL_OPERATION_SEARCH_ERROR', id: 'OAV123' },
    PathNotFoundInRequestUrl: { name: "PATH_NOT_FOUND_IN_REQUEST_URL", id: 'OAV124' },
    OperationNotFoundInCache: { name: "OPERATION_NOT_FOUND_IN_CACHE", id: 'OAV125' },
    OperationNotFoundInCacheWithVerb: { name: "OPERATION_NOT_FOUND_IN_CACHE_WITH_VERB", id: 'OAV126' }, // Implies we found correct api-version + provider in cache
    OperationNotFoundInCacheWithApi: { name: "OPERATION_NOT_FOUND_IN_CACHE_WITH_API", id: 'OAV127' }, // Implies we found correct provider in cache
    OperationNotFoundInCacheWithProvider: { name: "OPERATION_NOT_FOUND_IN_CACHE_WITH_PROVIDER", id: 'OAV128' }, // Implies we never found correct provider in cache
    DoubleForwardSlashesInUrl: { name: "DOUBLE_FORWARD_SLASHES_IN_URL", id: 'OAV129' }
  },
  EnvironmentVariables: {
    ClientId: 'CLIENT_ID',
    Domain: 'DOMAIN',
    ApplicationSecret: 'APPLICATION_SECRET',
    AzureSubscriptionId: 'AZURE_SUBSCRIPTION_ID',
    AzureLocation: 'AZURE_LOCATION',
    AzureResourcegroup: 'AZURE_RESOURCE_GROUP'
  },
  unknownResourceProvider: 'microsoft.unknown',
  unknownApiVersion: 'unknown-api-version',
  knownTitleToResourceProviders: {
    'ResourceManagementClient': 'Microsoft.Resources'
  }
}
