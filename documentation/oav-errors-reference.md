# OAV Errors Reference

This document includes further reference for errors reported by `oav` validate-example command.

## Index

- [Errors index](#errors-index)
- [Errors Descriptions](#errors-descriptions)

## Errors index

Errors described below may apply in request or response, your result output will indicate location of the issue.

| Error Code                                                                    |
| ----------------------------------------------------------------------------- |
| [INVALID_TYPE](#INVALID_TYPE)                                                 |
| [INVALID_FORMAT](#INVALID_FORMAT)                                             |
| [INVALID_CONTENT_TYPE](#INVALID_CONTENT_TYPE)                                 |
| [ENUM_MISMATCH](#ENUM_MISMATCH)                                               |
| [ENUM_CASE_MISMATCH](#ENUM_CASE_MISMATCH)                                     |
| [ONE_OF_MISSING](#ONE_OF_MISSING)                                             |
| [ONE_OF_MULTIPLE](#ONE_OF_MULTIPLE)                                           |
| [OBJECT_MISSING_REQUIRED_PROPERTY](#OBJECT_MISSING_REQUIRED_PROPERTY)         |
| [OBJECT_ADDITIONAL_PROPERTIES](#OBJECT_ADDITIONAL_PROPERTIES)                 |
| [RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE](#RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE)   |
| [RESPONSE_SCHEMA_NOT_IN_SPEC](#RESPONSE_SCHEMA_NOT_IN_SPEC)                   |
| [REQUIRED_PARAMETER_EXAMPLE_NOT_FOUND](#REQUIRED_PARAMETER_EXAMPLE_NOT_FOUND) |
| [RESPONSE_STATUS_CODE_NOT_IN_SPEC](#RESPONSE_STATUS_CODE_NOT_IN_SPEC)         |

## Errors Descriptions

Errors from OAV validate-example command will include:

- Operation: Name of the operation where error is reported
- Scenario: Example scenario being used for the validation
- Severity: Ranges from 0-4. Severity 0 errors are the most important to fix.
- Source: Whether the issue is found in request or response
- Message/Details: Additional details regarding the issue, including path where the error occurs and property name where applicable. Inner errors may also provide additional information on where the problem is coming from.

### <a name="INVALID_TYPE" />INVALID_TYPE

**Severity** : 0

**Message** : Expected type X but found type Y

**Location**: Path to where the issue occurs, params names or property names should be reported as part of the error details.

**Description**: Expected type X corresponds to the type inferred from data for the model/property. Specification indicates model/property is of type Y. A case like "Expected type object but found type undefined" for a response, may indicate there was no body present in the response.

**How to fix the issue**: Verify whether the data used as instance of the model is incorrect or the specification does not properly describe the type.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="INVALID_FORMAT" />INVALID_FORMAT

**Severity** : 0

**Message** : Object didn't pass validation for format X.

**Location**: Path to where the issue occurs, params names or property names should be reported as part of the error details.

**Description**: Property/Model specifies a format, for example date-time, and data used to validate does not comply with the specified format. Possible format values per OpenAPI spec 2.0 are [here](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#dataTypeFormat).

**How to fix the issue**: Verify whether the data used as instance of the model is incorrect or the specification does not properly match the format specified.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="INVALID_CONTENT_TYPE" />INVALID_CONTENT_TYPE

**Severity** : 1

**Message** : Invalid Content-Type (X). These are supported: Y. _Example: "Invalid Content-Typ (application/octet-stream). These are supported: application/json."_

**Location**: Applies at spec global level or operation level if explicitly specified.

**Description**: ARM specs use genearally content type `application/json`, Data plane specs may use other content types. This error surfaces quite often as the content type is not specified in the spec and the validation tool uses the default ("application/octet-stream").

**How to fix the issue**: this issue is not required to be fixed for ARM specs as code generation generally default to application/json. Other content-types should be explicitly specified.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="ENUM_MISMATCH" />ENUM_MISMATCH

**Severity** : 0

**Message** : No enum match for: `<type>`

**Location**: Path to where the issue occurs, params names or property names should be reported as part of the error details.

**Description**: Data does not match any of the values enumerated for the model property.

**How to fix the issue**: Ensure spelling of the data and enumeration described in the spec match exactly.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="ENUM_CASE_MISMATCH" />ENUM_CASE_MISMATCH

**Severity** : 0

**Message** : Enum doesn not match case for: `<name>`

**Location**: Path to where the issue occurs, params names or property names should be reported as part of the error details.

**Description**: Data does not match casing of the values enumerated for the model property.

**How to fix the issue**: Ensure casing of the and enumeration described in the spec match exactly.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="ONE_OF_MISSING" />ONE_OF_MISSING

**Severity** : 0

**Message** : Data does not match any schemas from 'oneOf'

**Location**: Path to where the issue occurs, params names or property names should be reported as part of the error details.

**Description**: When polymorphism is used in the OpenAPI spec by specifying discriminator types, the tool may compare data with multiple models in the discriminator type hierarchy. This error indicates that it could not find a model/schema to match the data provided.

**How to fix the issue**: Review your discriminator types and make sure that the data matches the appropriate type from the hierarchy.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="ONE_OF_MULTIPLE" />ONE_OF_MULTIPLE

**Severity** : 0

**Message** : Data is valid against more than one schema from 'oneOf'

**Location**: Path to where the issue occurs, params names or property names should be reported as part of the error details.

**Description**: When polymorphism is used in the OpenAPI spec by specifying discriminator types, the tool may compare data with multiple models in the discriminator type hierarchy. This error indicates that there is no unique model/type in the OpenAPI spec matching the provided data.

**How to fix the issue**: Review your discriminator types and make sure that the data matches the appropriate type from the hierarchy.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="OBJECT_MISSING_REQUIRED_PROPERTY" />OBJECT_MISSING_REQUIRED_PROPERTY

**Severity** : 0

**Message** : Missing required property: `<property>`

**Location**: Path to where the issue occurs, params names or property names should be reported as part of the error details.

**Description**: Data does not contain a property that's specified as `required` in the OpenAPI spec.

**How to fix the issue**: Verify whether the property is `required` as indicated in the spec, if it is, data should contain it, if it isn't OpenAPI spec should be updated to remove `require` restriction.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="OBJECT_ADDITIONAL_PROPERTIES" />OBJECT_ADDITIONAL_PROPERTIES

**Severity** : 0

**Message** : Additional properties not allowed: `<list of properties>`

**Location**: Path to where the issue occurs, params names or property names should be reported as part of the error details.

**Description**: Data contains properties that have not been specified in the OpenAPI spec.

**How to fix the issue**: If additional properties existent in the data are present in the service, please update your OpenAPI spec accordingly to include them.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE" />RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE

**Severity** : 0

**Message** : Following response status codes "X,Y" for operation "ABC" were present in the swagger spec, however they were not present in x-ms-examples. Please provide them.

**Location**: Path to operation missing data.

**Description**: When providing x-ms-examples, all successful status codes described in the OpenAPi spec should have a corresponding data section in the example.

**How to fix the issue**: Provide sample data in the example file for the missing status codes.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="RESPONSE_SCHEMA_NOT_IN_SPEC" />RESPONSE_SCHEMA_NOT_IN_SPEC

**Severity** : 0

**Message** : Response statusCode "X" for operation "ABC" has response body provided in the example, however the response does not have a "schema" defined in the swagger spec.

**Location**: Path to operation missing data.

**Description**: When providing x-ms-examples, if there's a body of response provided in the data, the OpenAPI spec should specify a "schema" with the model representing the data.

**How to fix the issue**: Verify that the OpenAPI spec describes the response schema according to the service.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="REQUIRED_PARAMETER_EXAMPLE_NOT_FOUND" />REQUIRED_PARAMETER_EXAMPLE_NOT_FOUND

**Severity** : 0

**Message** : In operation X, parameter Y is required in the swagger spec but is not present in the provided example parameter values.'.

**Location**: Path to operation missing data.

**Description**: When providing x-ms-examples, there's a required parameter indicated in the OpenAPI spec, but there's no paramater value in the corresponding provided example.

**How to fix the issue**: Verify that the required parameter value is in the example or confirm that the OpenAPI spec is describing the parameter correctly, whether it's required or not. If the paramater is not required on the service side, an update to the OpenAPI specification may be required.

Links: [Index](#index) | [Error descriptions](#error-descriptions)

### <a name="RESPONSE_STATUS_CODE_NOT_IN_SPEC" />RESPONSE_STATUS_CODE_NOT_IN_SPEC

**Severity** : 0

**Message** : Response statusCode X for operation Y is provided in example, however it is not present in the swagger spec.

**Description**: There is a status code specified in the example file referenced, which is not described in the OpenAPI spec.

**How to fix the issue**: Remove the status code from example that is not specificed in the spec, or check whether the status code should be added to the OpenAPI spec.

Links: [Index](#index) | [Error descriptions](#error-descriptions)
