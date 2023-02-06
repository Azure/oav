# Change Log - oav

## 02/03/2023 3.2.5

- generate-api-scenario
  - Support `--scope` option in static generator
- API Scenario
  - Skip create and delete resource group if specify resource group name

## 01/30/2023 3.2.4

- API Scenario
  - Support scenario file as scope
  - Support test-proxy recording externalization with `--testProxyAssets` option
  - Support `--randomSeed` option
- validate-traffic
  - Add `--jsonReport` parameter in command `validate-traffic`

## 12/01/2022 3.2.4

- Generate Examples - Support specified generation rule
- API Scenario
  - Support file type in formdata and body
  - Change the prefix length to 8 from 10 in generated API Scenario

## 11/23/2022 3.2.3

- AjvSchemaValidator - Ignore unknown format when compile schema

## 11/07/2022 3.2.2

- API Scenario
  - Support LRO polling with operation-location header
  - Support AzureKey based authentication

## 10/20/2022 3.2.1

- ModelValidator - Fix bug during reporting real exampleJsonPath
- ModelValidator - Add LRO header validation for data-planes swagger
- GenerateExamples - Add title and operationId to example
- GenerateExamples - Generate subscriptionId in guid format
- ModelValidator - Add type validation for additionalProperties whose type is specified as an object
- Bugfix: FileLoader - isUnderFileRoot function supports validation for absolute path
- API Scenario
  - Add roleAssignment step
  - Bugfix: Use content-type specified in swagger
  - Bugfix: fix query parameter value type

## 10/10/2022 3.2.0

- Retire some features
  - Retire commands "generate-uml"
  - Retire commands "generate-wireformat"
  - Retire commands "resolve-spec"
  - Retire Autorest plugin

## 09/19/2022 3.1.0

- API Scenario
  - Support parameterized host and AzureAD authentication option
  - Remove support for `shareScope`
  - Refactor postman collection generation with folders
  - Improve LRO poller and use retry-after header in delay
  - Improve logging level to reuse the `-l` option
  - Clean some unused dependencies
  - Support Roundtrip validation in validation
  - Integrate Roundtrip validation into API Scenario

## 09/06/2022 3.0.6

- AJV validator - Support arm-id format validation
- ModelValidator - Only enable arm-id validation for both of model validator and live validation(rpaas api validation is excluded)

## 08/04/2022 3.0.5

- ModelValidator - Support api-version validation
- ModelValidator - Fix bug when operation has no own parameters
- validate-traffic
  - add detailed operationId on swagger link
  - add detailed position info on pathInpayload link
  - add detailed position info on schema link
  - change report UI
  - support multi swaggers on report
- API Scenario
  - Support Subscription and Tenant scope
  - Support assertion in response

## 07/20/2022 3.0.4

- GenerateExamples - Support data generation in byte format
- ModelValidator - Support data validation in byte format
- API Scenario
  - Support readme.test.md run API test
  - Fix step variable unresolved in newman collection
  - Fix bugs about html report
  - Aggregate reports into one per scenario file
  - Fix bug of object variables and patches
  - Improve markdown report

## 07/06/2022 3.0.3

- Generate high quality examples from API Scenario tests

## 06/30/2022 3.0.2

- traffic-converter
  - Implement [oav-traffic-converter](https://github.com/Azure/azure-sdk-tools/tree/main/tools/oav-traffic-converter)
- Add activity parsed from request header to logs

## 06/10/2022 3.0.1

- GenerateExamples - Change the domain of LRO header
- ModelValidator - Still validate LRO operation when response doesn't have schema
- ModelValidator - Report real exampleJsonPath when additional parameter includes "."
- Support duration format when generating examples
- SemanticValidator - Fix bug about multipart/form-data

## 06/10/2022 3.0.0

- API Scenario runner
  - Implement [API Scenario v1.2 schema](https://github.com/Azure/azure-rest-api-specs/blob/main/documentation/api-scenario/references/v1.2/schema.json)
    - operationId based step
    - more variable types and prefix support
  - Support loading file from remote uri
  - Support [testProxy](https://github.com/Azure/azure-sdk-tools/tree/main/tools/test-proxy) recording mode when running API Scenario
  - Improve API Scenario generation from RESTler dependencies
  - Support running API Scenario against localhost endpoint
  - Refactor Postman based runner client
  - Support API Scenario generation from testProxy recording
  - Support local devMode where AAD auth, ARM call and LRO polling will be disabled

## 05/27/2022 2.12.2

- LiveValidator - Get real schema and data while error's schema has allOf property
- TrafficValidator - Refine validation report
- SemanticValidator - Support arm-id format for string type

## 04/20/2022 2.12.1

- Fix bug about copyfiles command during build

## 04/07/2022 2.12.0

- ModelValidator - Ignore INVALID_TYPE validation in case of query parameter in string format
- Traffic Validation - Support validation report generation

## 04/06/2022 2.11.10

- SemanticValidator - Fix bug about error path.

## 03/11/2022 2.11.9

- Api Scenario - Fix bug about readonly during example diff.

## 02/23/2022 2.11.8

- SemanticValidator - Clarify the error message when NOT schema of 'path' fails
- Add coverage for trafficValidator
- FIx GC introduced by 2.11.7

## 02/15/2022 2.11.7

- LiveValidator - Fix bug about date-time validation.
- LiveValidator - Fix bug about duplicated swagger files when loading by path patterns.

## 02/14/2022 2.11.6

- Upgrade newman package to 5.3.1. Fix intel license issue.
- Fix simple git high security issue.

## 01/21/2022 2.11.5

- LiveValidator - Loosen date-time validation for missing "Z" in the end
- LiveValidator - Validate multipleOf data again when ajv validation results have error about multipleOf in response

## 12/15/2021 2.11.4

- LiveValidator - Ignore required validation rule in response when x-ms-secret is true and the httpMethod is POST
- ModelValidator - add validation for common path scope parameters in swagger
- ModelValidator - Increase model validation test coverage to 90%+
- ModelValidator - Ignore LRO_RESPONSE_CODE validation in case of error responses
- ModelValidator - fix failed to resolve discriminator models in nested definitions

## 12/03/2021 2.11.3

- Utils - move get provider related functions to utils because of DI error

## 12/02/2021 2.11.2

- LiveValidator - add more unittest for data-plane spec path
- OperationSearcher - use local variable instead of glob regex

## 12/01/2021 2.11.1

- LiveValidator - Supports logging spec loading traces separately
- Fix `getProviderFromSpecPath` regex issue and add unittest

## 11/30/2021 2.11.0

- Api scenario - add new step armDeploymentScript
- Api scenario - rename step armTemplateDeployment to armTemplate

## 11/10/2021 2.10.3

- Fix 'generate-examples' command failed to generate correct format for ‘uri’ format parameter
- LiveValidatorLoader - make response headers as optional for swagger 2.0
- LiveValidator - ignore LRO header check if using 201/200+ provisioningState
- SemanticValidator - Fix false alarm for MISSING_PATH_PARAMETER_DEFINITION
- ModelValidator/SemanticValidator - support suppression on error code
- Use `new URL` instead of `url.parse`. Since url.parse will encode url and will be deprecated.
- SemanticValidator - Add new rules of 'INVALID_XMS_DISCRIMINATOR_VALUE' and 'DISCRIMINATOR_PROPERTY_NOT_FOUND'

## 11/04/2021 2.10.2

- Traffic validation - support multiple swaggers and multiple payloads
- Extends format types in AJV schema validation
- Bug fix - check discriminator property type must be string
- Bug fix for generate api scenario
- Fix jsonPathToArray bug (which will incorrectly transform ["Microsoft.something"] into ["Microsoft", "something"])
- Upgrade autorest scheams about x-ms-enum change
- Model/Live validation - fix content-type validation and unknown format issue during validator building

## 10/26/2021 2.10.1

- MV - Fix error conversion issue of invalid token parsing in model validation
- Api scenario generation support swagger file as input parameters

## 10/20/2021 2.10.0

- Add new version of model validation

## 10/19/2021 2.9.2

- Increase semantic validation test coverage to 90%+
- Export loader types

## 09/30/2021 2.9.1

- Example extractor support add url parameter if define x-ms-parameterized-host

## 09/30/2021 2.9.0

- Rename test scenario to API scenario
- Implement API scenario v1.1 schema
- Support PATCH operation in API scenario step
- Add convention for ArmTemplate parameters
- Support cleanUp steps
- Fix xMsExampleExtractor bug

## 09/03/2021 2.8.1

- support calculate test scenario operation coverage
- OAV runner support step scope variables
- Fix runner armTemplate output as runtime variable
- Runner support identify step level variables by using different variable name prefix.

## 08/17/2021 2.8.0

- Isolate RP when running transform on cache model in live validator so that the transform won't fail on global cache level
- Fix type error in nullableTransformer
- Throw exception when getting error in transformLoadedSpecs at livevalidator initialization
- Improve wording of error messages
- Support resolve body variables in armTemplate
- Do not write default variable with placeholder
- Fix validate-traffic file path resolved error.
- Fix generate-examples can't generate some http code in response

## 08/12/2021 2.7.3

- Refactor semantic validation using AJV
- Enable url path for a swagger loading

## 08/09/2021 2.7.2

- Add runner architecture drawio
- Oav runner run test scenarios sequentially
- Oav runner can reuse the 'after-step' environment of the previous step in debugging mode.

## 08/03/2021 2.7.1

- Disable checkUnderFileRoot in `Validate Traffic` command

## 07/21/2021 2.7.0

- Oav runner support specifying option 'runId' with option 'from' and/or 'to' to debug.
- Oav runner support using env variable 'TEST_SCENARIO_JSON_ENV' to override variables in env.json.
- Replace Oav runner option 'cleanUp' with 'skipCleanUp'.
- Update README.md add gif to show API test
- Fix bug. Avoid duplicate step name when generate postman collection
- Small bug fix. Set postman collection subscriptionId env when do AAD auth
- Response diff ignore exception

## 07/15/2021 2.6.2

- Bug Fix: `validate-traffic` command doesn't support relative path input

## 7/13/2021 2.6.1

- Oav test scenario runner support output variables from step
- New oav command "oav run" alias for "oav run-test-scenario" command
- Oav runner support dryRun mode. Only generate postman collection
- Oav runner support predefined resourceGroup and skip cleanUp
- Test scenario schema support "requestUpdate" and "outputVariables" syntax
- Fix resourceUpdate bug

## 07/08/2021 2.6.0

- Support `validate-traffic <traffic-path> <spec-path>` command in OAV cli

## 07/05/2021 2.5.9

- Ignore LRO_RESPONSE_HEADER rule check in case of synchronous api call

## 06/25/2021 2.5.8

- support extract armTemplate deployment output to variables

## 06/22/2021 2.5.7

- small fix for passing validation-level

## 06/22/2021 2.5.6

- optimise validation logical. Ignore readonly and secret property response check
- DO NOT output log when request method is POST
- Support level option. Current two levels: validate-request, validate-request-response. validate-request will only check request parameters. validate-request-response check both request and response.
- Improve test scenario markdown report format
- Bugfix: packaging issue for handlebar files
- Add test scenario JUnit xml report support

## 6/10/2021 2.5.5

- add markdown report support for test scenario runner
- support rule based test scenario generation
- rename error code
- fix relative path bug

## 5/27/2021 2.5.4

- Analyze dependency return resource id schema reference
- Bug fix: test scenario get arm deployment parameters
- Bug fix: test scenario definition step use anyOf instead of oneOf.
- Postman runner support check armTemplate deployment status

## 5/25/2021 2.5.3

- Ignore MISSING_RESOURCE_ID rule for sub level azure resources

## 5/18/2021 2.5.2

- Supports different log types in livevalidator

## 5/13/2021 2.5.1

- test scenario runner support overwrite location, armEndpoint, subscriptionId

## 05/12/2021 2.5.0

- Optimise report blob path.
- Support mask client secret, token and swagger sensitive data
- Refine report schema
- Response diff ignore Id, location, datetime.
- Bump handlebars version to fix vulnerability issue

## 05/11/2021 2.4.0

- Support example generation with multiple operations input
- Added more logging and duration to live validator

## 04/14/2021 2.3.3

- Support auto upload generated file to azure blob.
- Support mask bearer token
- generate-static-test-scenario support generate readme.test.md

## 04/06/2021 2.3.2

- Support auto generate test scenario based on resource type.
- Support directly run test scenario file with embedded internal newman runner
- Support analyze dependency from readme tag.

## 03/30/2021 2.3.1

- Update error message of some rules to align to the document

## 03/24/2021 2.3.0

- Support load test-scenario file
- Support generate postman collection from test-scenario

## 02/08/2021 2.2.7

- Add new rules of 'LRO_RESPONSE_HEADER' and 'LRO_RESPONSE_CODE'.
- Add option of 'isArmCall' to differentiate rulesets for Arm and RpaaS in validation apis.

## 03/12/2021 2.2.6

- Fixed the mock value of 'location' header and 'azure_AsyncOperation' header.

## 02/08/2021 2.2.5

- Add new rule of 'MISSING_RESOURCE_ID'.
- Add option of 'isArmCall' to differentiate rulesets for Arm and RpaaS.

## 02/08/2021 2.2.4

- Bump version to republish since previous version is stuck to be fetched.

## 01/26/2021 2.2.3

- Bugfix collect correct err.data in discriminator validation for multiple level allOf

## 01/22/2021 2.2.2

- Bugfix for example generator: resolve reference undefined property.

## 01/21/2021 2.2.1

- Bugfix should copy required array for allOf transformer
- Bugfix collect correct err.data in discriminator validation

## 01/15/2021 2.2.0

- Enable support for test scenario parsing

## 11/25/2020 2.0.1

- Ignore required validation rule in response when x-ms-secret is true
- Ignore schema validation when request body is not required and value is empty {}

## 11/23/2020 2.0.0

- Replace ts-common libraries by openapi-tools-common single library
- Adding example generation functionality
- Bugfix show source in response code not found
- Bugfix error on response body root
- Bugfix content type
- Downgrade tsconfig target to es2018
- Bugfix Don't report error if readme.md is found outside of rootpath
- Remove readonly/writeonly/secret value in description and params
- Bugfix exclusiveMinimum not reported
- Adding new code DISCRIMINATOR_VALUE_NOT_FOUND

## 07/24/2020 0.22.1

- Upgrade yasway with removing clonedeep when validate schema.

## 07/09/2020 0.21.7

- Fix the bug that the value of 'x-ms-secret' should be boolean instead of string.

## 05/21/2020 0.21.6

- Avoid adding nullable value for parameter when its' type isn't string
- Output exception infomation for semantic validation

## 04/20/2020 0.21.5

- Output exception information when pretty switch is enabled.

## 04/10/2020 0.21.4

- Instead of replacing all the special characters in path parameters, only replace the part of parameter value which start with (http:|https:)
- Upgrade ms-rest version to 2.5.4

## 03/30/2020 0.21.3

- Upgrade yasway version including the fix on regression issue of customvalidator.

## 03/27/2020 0.21.2

- Upgrade yasway version including the fix on global parameter in request validation and x-ms-mutability check for read in request.

## 03/16/2020 0.21.1

- Enabled request parameter suppression in model validation.

## 03/16/2020 0.21.0

- Fixed oav does not report the invalid internal references error issue. Added a function (verfiyInternalReference) to check the error.

## 03/13/2020 0.20.13

- Normalize the path parameter values by using whilelist (0-9a-zA-Z.\_) to fix the issue of validate-example failed
  which caused by host path parameter values including special characters (:)

## 03/10/2020 0.20.12

- Fixed typeerror in live validator when search operation in case of unknownapiversion

## 03/03/2020 0.20.11

- Upgrade openapi-markdown package version

## 03/02/2020 0.20.10

- Upgrade virtual-fs package version

## 02/13/2020 0.20.9

- Fall back to match child resource in live validator

## 02/13/2020 0.20.8

- The path matching for subscription and provider in Live validation should be case-insensitive.

## 02/05/2020 0.20.7

- Add base model name as a value to discriminator enum value list.[Issue#468](https://github.com/Azure/oav/issues/468)

## 01/16/2020 0.20.6

- security vulnerability fix for handlebars, kind-of and lodash

## 12/26/2019 0.20.4

- Upgrade yasway and z-schema version.

## 12/05/2019 0.20.3

- Change the swaggerPathsPattern of LiveValidatorOptions to array type

## 11/26/2019 0.20.2

- Upgrade yasway version to consume the change for x-ms-secret property update

## 11/20/2019 0.20.1

- Resource provider and API version should be case-insensitive in live validation
- Upgrade yasway version to reflect the deep clone performance improvement change

## 11/4/2019 0.20.0

- Support x-ms-mutability in the response validation. If there's a write-only x-ms-mutabitlity property in the response, report an error

## 10/22/2019 0.19.9

- Extends logging for live validator to log performance metrics, correlationId and structured request information.

## 10/14/2019 0.19.8

- Add an optional logging callback to consume by livevalidator in order to dump log to external caller.
- Update the yasway version to 1.8.5.
- Add the new validation error code of SECRET_PROPERTY.

## 09/04/2019 0.19.6

- Report example position for request parameter errors [Issue#423](https://github.com/Azure/oav/issues/423).
- Fixed internal error when load invalid local reference file [Issue#449](https://github.com/Azure/oav/issues/449).
- Fixed internal error when load empty reference file [Issue#444](https://github.com/Azure/oav/issues/444).

## 09/03/2019 0.19.5

- Add package.lock file to lock the version of dependencies.

## 08/12/2019 0.19.4

- Update the error handling when loading and parsing suppression files.

## 07/30/2019 0.19.3

- Fixed validation of nullable array types if they were defined as tope level models or transformed into top level models in the `"definitions"` object. Fixes #437.
- Fixed an issue where `"properties": {}` was being incorrectly added to a schema with `"$ref"` in the response or a top level `array`.

## 07/12/2019 0.19.2

- Add support for validating discriminator is required and also the support for suppression.[Issue#386](https://github.com/Azure/oav/issues/386).

## 07/02/2019 0.19.1

- Update TypeScript to 3.5
- `@types/jsonpath` is a dependency because `PathComponent` type from the package is exported in `lib/util/validationError.ts`.

## 07/12/2019 0.19.0

- Modify path in payload for MISSING_REQUIRED_PROPERTIES and for OBJECT_ADDITIONAL_PROPERTIES to point to the actual property.

## 07/02/2019 0.18.6

- Adding support for JSON path & schema path in errors.
- Improved model validation when example provides the response body however the spec doesn't have a schema for the response and vice-versa.

## 06/12/2019 0.18.5

- Added support for JSON path & schema path in errors.

## 05/30/2019 0.18.4

- Better error reporting for spec reference pointing to invalid files.

## 05/29/2019 0.18.3

- Update cache initialization in live validator to `Promise.all()`.
- Update package version of `yuml2svg` dependency (since it contains typescript definitions).
- Add support for validating `readOnly` properties in the request.
- Limiting dependencies on `@types/lodash` and `typescript` due to stricter type definition rules in the later versions.

## 04/25/2019 0.18.2

- Use node env for jest #422.

## 04/08/2019 0.18.1

- Validate request body when it is a JSON object.

## 04/08/2019 0.18.0

- The `isSuccessful` is `undefined` in case of an existing `runtimeException`.
- `RequestResponseLiveValidationResult` has a runtimeExceptions field instead of an errors field.

## 04/05/2019 0.17.0

- Live Validation mode is now skipping validating for errors not specified when using the `includeErrors` option.
- The types `RequestValidationResult` and `ResponseValidationResult` have been replaced with the `LiveValidationResult` type.

## 04/05/2019 0.16.1

- OAV should exit with code `1` if it finds errors.
- Breaking changes in SpecValidationResult, CommonValidationResult.

## 04/01/2019 0.15.3

- Polymporphic anyOf's will be validated only against the matching subschema and any error wont be nested.

## 04/01/2019 0.15.2

- Inner errors will have the `LiveValidationIssue` type instead of`object`.

## 03/28/2019 0.15.1

- Allow for live validation to exclude/include specific errors.

## 03/27/2019 0.15.0

- Refactor live validator and new types for validation results.
- Expose separate request and response validate methods.
- Expose types for live validation parameters.
- `processValidationErrors`, `serializeErrors` and `getPotentialOperations` are not exported anymore. Validation methods automatically call these.

## 03/20/2019 0.14.8

- Don't parse examples when not needed.
- Remove example references when not needed to avoid "UNRESOLVABLE_REFERENCE" errors.

## 03/20/2019 0.14.7

- Change test runner to jest.

## 03/19/2019 0.14.6

- Don't resolve x-ms-examples for live validation and for semantic validation.

## 03/07/2019 0.14.5

- Fixing linting and coding style issues.

## 03/08/2019 0.14.4

- `INTERNAL_ERROR` as an error code.

## 03/07/2019 0.14.3

- OAV shouldn't parse `error.title` twice.

## 03/06/2019 0.14.2

- Use one cache per SpecValidator inside the LiveValidator.

## 03/06/2019 0.14.1

- Add doc cache during `LiveValidator initialization` to reduce memory footprint and execution time.

## 03/06/2019 0.14.0

- Remove package level global doc cache.
- Remove external exports of `clearCache()` and of `executePromisesSequentially()`

## 02/06/2019 0.13.6

- Polymorphic models should have `"type": "object"`.

## 02/05/2019 0.13.5

- Fixing `ONE_OF_MULTIPLE`. It was caused by `x-ms-enum.modelAsString` which validates
  discriminators as an unrestricted strings

## 01/29/2019 0.13.4

- Provide url and file position for these errors:
  - `RESPONSE_STATUS_CODE_NOT_IN_SPEC`,
  - `RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE`,
  - `XMS_EXAMPLE_NOT_FOUND_ERROR`,
  - `DOUBLE_FORWARD_SLASHES_IN_URL`,
  - `RESPONSE_SCHEMA_NOT_IN_SPEC`, and
  - `REQUIRED_PARAMETER_EXAMPLE_NOT_FOUND`.

## 01/28/2019 0.13.3

- Provide url and file position for `RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE` errors.

## 01/23/2019 0.13.2

- Update `z-schema`.

## 01/18/2019 0.13.1

- Handle `text-matches` in suppression.

## 01/15/2019 0.13.0

- JSON types are updated.

## 01/14/2019 0.12.0

- Simplify model and semantic property names. `errorCode` becomes `code` and `errorDetails` becomes `details`.

## 01/14/2019 0.11.1

- Replace an example object with a function to avoid reference resolutions in examples.

## 01/08/2019 0.11.0

- Remove JS symbols from errors to avoid logging failure.

## 01/08/2019 0.10.4

- remove `ts-node`

## 12/11/2018 0.10.3

- exporting NodeError to consume it outside of oav..

## 12/07/2018 0.10.2

- no default response for non errors.

## 12/07/2018 0.10.1

- update `@ts-common/virtual-fs` to retry network requests.

## 12/05/2018 0.10.0

- no `CloudError` generation.

## 12/01/2018 0.9.7

- Properly handle JSON errors

## 11/29/2018 0.9.6

- update `@ts-common/json-parser` to properly handle UNICODE escape symbols.

## 11/28/2018 0.9.5

- catch `jsonpath` exceptions.
- Better internal structure.

## 11/27/2018 0.9.4

- Improve exception/error message.

## 11/26/2018 0.9.3

- Use `z-schema` instead of `@ts-common/z-schema`.

## 11/21/2018 0.9.2

- Remove `rewire()` package.

## 11/20/2018 0.9.1

- getErrorsFromSemanticValidation().

## 11/19/2018 0.9.0

- Improve error types.

## 11/16/2018 0.8.1

- Suppressions may have multiple `where` and `from` fields. OAV didn't handle it properly.

## 11/08/2018 0.8.0

- a source map for CloudError
- a bug fix for embedded examples.

## 11/08/2018 0.7.14

- update swagger definition

## 10/23/2018 0.7.13

- switch to Azure DevOps.

## 10/23/2018 0.7.12

- switch from `@ts-common/azure-openapi-markdown` to `@azure/openapi-markdown`.

## 10/15/2018 0.7.11

- exported functions don't catch exceptions.

## 10/15/2018 0.7.10

- Provide Title for all Schema Objects.

## 10/12/2018 0.7.9

- Additional source map for generated Schema objects.

## 10/09/2018 0.7.8

- Update `@ts-common/azure-openapi-markdown` package.

## 10/08/2018 0.7.7

- Fix a bug applying suppressions from HTTPS.

## 10/08/2018 0.7.6

- Fix a bug in ReadFile from HTTPS.

## 10/08/2018 0.7.5

- Get suppressions from HTTPS.

## 10/03/2018 0.7.4

- Fix `@ts-common/source-map` `.d.ts` files.

## 10/02/2018 0.7.3

- Suppress promise rejection.

## 10/02/2018 0.7.2

- Fix URL encoding test.

## 10/02/2018 0.7.1

- Fix yasway.

## 10/01/2018 0.7.0

- Suppression API is changed.

## 09/27/2018 0.6.5

- Suppression supports relative file and object paths.

## 09/25/2018 0.6.4

- Source Map for `.d.ts` files.

## 09/25/2018 0.6.3

- Source Map

## 09/25/2018 0.6.2

- Bug fix for `resolve-spec` CLI (#320)

## 09/25/2018 0.6.1

- Semantic validation warning bug fix.

## 09/21/2018 0.6.0

- Suppression. `where` is not supported yet.

## 09/21/2018 0.5.13

- Correcting where we add url and position information to semantic validation errors.

## 09/19/2018 0.5.12

- Adding url and position to source where issue occurs for semantic validation errors.

## 09/19/2018 0.5.11

- Adding pretty printing to validate-spec command, --pretty option.

## 09/17/2018 0.5.10

- xMsExamplesExtractor bug fix #309

## 09/11/2018 0.5.9

- OAV is using '@ts-common/z-schema' instead of 'z-schema'

## 09/10/2018 0.5.8

- Fix JSON-Pointer encoding.

## 08/28/2018 0.5.7

- Errors have optional `jsonUrl` and `jsonPosition` fields.

## 08/22/2018 0.5.6

- CloudError proper fix

## 08/22/2018 0.5.5

- CloudError bug fix #300.

## 08/22/2018 0.5.4

- Simplified source-map

## 08/21/2018 0.5.3

- Friendly nested definition name

## 08/21/2018 0.5.2

- Bug fix for `"type": "file"`

## 08/17/2018 0.5.1

- File URL and position in title

## 08/17/2018 0.5.0

- File URL and position

## 08/16/2018 0.4.70

- New transformation functions.

## 08/14/2018 0.4.69

- Collapse of similar errors for array elements in `similarPaths` property on the error.

## 08/13/2018 0.4.68

- Using a JSON parser with a source map.

## 08/11/2018 0.4.67

- Single error for not matching any discriminated types.

## 08/10/2018 0.4.66

- Use JSON Pointer format for inserted schema title for properties and definitions.

## 08/10/2018 0.4.65

- Include property name as schema title in the property object.

## 08/10/2018 0.4.64

- Include definition name as schema title in the definitions.

## 08/01/2018 0.4.63

- Replacing `reduce` error collections with lazy iterators.

## 07/18/2018 0.4.62

- Solve security vulnerabilities

## 07/18/2018 0.4.61

- Export more types

## 07/18/2018 0.4.60

- Use `yasway` type definitions

## 07/18/2018 0.4.59

- Bug fix: `scenarios is undefined` when running AutoRest plugin.

## 07/17/2018 0.4.58

- export additional types.

## 07/05/2018 0.4.57

- `--pretty` output.

## 07/05/2018 0.4.56

- Error serialization.

## 07/05/2018 0.4.55

- Remove a dependency on `@types/winston` package. `winston` is updated to `3.0.0`.

## 06/21/2018 0.4.54

- Apply rules for Nested Properties

## 06/26/2018 0.4.51

- Bug fix: Do BOM stripping for remote URL's [#266](https://github.com/Azure/oav/issues/266).

## 06/20/2018 0.4.50

- Replace sway dependency with yasway.

## 06/19/2018 0.4.49

- Bug fix: Data is valid against more than one schema from `oneOf` [#248](https://github.com/Azure/oav/pull/248)
  The problem occurs when referenced model may also accept `null`. The fix is replacing `oneOf` with `anyOf`.

## 05/14/2018 0.4.38

- Bug fix: `oav extract-xmsexamples` also extracts request headers. [#241](https://github.com/Azure/oav/pull/241)
- Bug fix: x-ms-parametrized-host is not validated correctly [#240](https://github.com/Azure/oav/issues/240)

## 04/23/2018 0.4.37

- Update dependencies.
- Bug fixes: [#238](https://github.com/Azure/oav/pull/238)
  - Path parameters can include single quotes and be evaluated succesfully.
  - Enums with non-string values are properly evaluated.

## 04/19/2018 0.4.36

- If enums mismatch only in casing the new error ENUM_CASE_MISMATCH will be returned.

## 03/15/2018 0.4.35

- Validate default responses. [#228](https://github.com/Azure/oav/issues/228)
- Add option to model an implicit default cloud error response. [#224](https://github.com/Azure/oav/issues/224)

## 03/08/2018 0.4.34

- Updating default output level to info.
- Fixing issue #225, where output verbosity wasn't respected in one case.

## 02/28/2018 0.4.33

- Don't validate pure objects.

## 02/05/2018 0.4.32

- Fix bug for resolve external references introduced part of #202.

## 02/05/2018 0.4.31

- Bug fix for the fix made to resolve jshint issues in #202.

## 02/05/2018 0.4.30

- Improve matching for status code string for live validation.

## 02/05/2018 0.4.29

- Add support for live validation to support status code string along the status code number.
- Update to use package autorest-extension-base from npm.

## 02/01/2018 0.4.28

- Fix undefined headers issue when the spec does not define consumes values.

## 01/31/2018 0.4.27

- Updating dependency of lodash to 4.17.4.

## 01/31/2018 0.4.26

- Fix all linter issues. [#201](https://github.com/Azure/oav/issues/201)
- Add option to do case insensitive regex matches on swagger paths to the SpecValidator and LiveValidator. [#203](https://github.com/Azure/oav/issues/203)

## 01/30/2018 0.4.25

- Fixed a typo in the variable name while resolving nullable types.

## 01/17/2018 0.4.24

- The tool does not error on missing definitions in the swagger spec #194
- Added support for application/octet-stream or file upload/download scenarios #192

## 01/05/2018 0.4.23

- Addressing INVALID_TYPE issues reported by model validation due to nullable types/properties. [#155](https://github.com/Azure/oav/issues/155). In order to allow null types, we relax types to be 'oneOf' `null` or its type, for the cases where properties/models have x-nullable set or x-nullable is not defined and property is not required.

## 12/11/2017 0.4.22

- Added support to generate class diagram from a given swagger spec #188.
- Fixed #190, #191.

## 12/4/2017 0.4.21

- Removed the enum constraint or reference to an enum on the discriminator property if previously present before making it a constant.

## 11/20/2017 0.4.20

- Added support for processing [`"x-ms-parameterized-host": {}`](https://github.com/Azure/autorest/tree/master/docs/extensions#x-ms-parameterized-host) extension if present in the 2.0 swagger spec.

## 11/19/2017 0.4.19

- Added support for validating examples for parameters `"in": "formData"`.

## 11/09/2017 0.4.18

- Ensure scheme, host and basePath are used to construct the base url #180.

## 10/24/2017 0.4.17

- Disable resolving discriminators while performing semantic validation for an open api specification that conforms to 2.0 version.

## 10/20/2017 0.4.16

- Entire tree except the leaf nodes need to be traversed for replacing references of (an uber(root) or intermediate) parent with a `"oneof"` array containing references to itself and all its children. #175

## 10/18/2017 0.4.15

- Updating model validator to resolve polymorphic types using oneOf. #171

## 10/17/2017 0.4.14

- Updating model validator to plugin to autorest.

## 09/12/2017 0.4.13

- Provide the filepath of the file that has an incorrect json. This makes it easy for customers to find out the faulty file among numerous files.

## 09/12/2017 0.4.12

- [Model Validator] Should handle forward slashes in path parameters. #165
- [Model Validator] Should handle question mark in paths that are defined in x-ms-paths. #140

## 08/30/2017 0.4.11

- [Wire Format Generator] Should handle resolved x-ms-examples. #161

## 08/23/2017 0.4.10

- [Wire Format Generator] Removed condition for checking 200 & 204 in final status code for non-LRO. #159
- [Wire Format Generator] Updated default directory to be the api-version folder of the swagger spec. #159

## 08/03/2017 0.4.9

- [Live Validator] Shallow clone the azure-rest-api-spec repo.
- [Model Validator] Improve pluggability of oav into vs-code. #143

## 08/03/2017 0.4.8

- [Live Validator] Before cloning the rest api specs repo if directory named 'repo' exists we delete it and then create an empty directory to clone repo inside it.

## 07/11/2017 0.4.7

- Fixed Live validator for reorg branch of azure-rest-api-specs #137

## 07/03/2017 0.4.6

- Fixed issue #134

## 06/26/2017 0.4.5

- Added support to generate wireformat as a YAML doc
- Improved the format to specify request body for a in a request using curl.
