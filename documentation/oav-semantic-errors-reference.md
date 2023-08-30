# OAV Errors Reference (Semantic Validation)

This document includes further reference for errors reported by `oav` validate-spec command. 

## Index
* [Errors index](#errors-index)
* [Errors Descriptions](#errors-descriptions)

## Errors index

Errors described below indicate semantically incorrect OpenAPI2.0 files.

| Error Code |
| --- |
| [EQUIVALENT_PATH](#EQUIVALENT_PATH)	|
| [OBJECT_MISSING_REQUIRED_PROPERTY_DEFINITION](#OBJECT_MISSING_REQUIRED_PROPERTY_DEFINITION) |
| [EMPTY_PATH_PARAMETER_DECLARATION](#EMPTY_PATH_PARAMETER_DECLARATION) |
| [DUPLICATE_OPERATIONID](#DUPLICATE_OPERATIONID) |
| [MULTIPLE_BODY_PARAMETERS](#MULTIPLE_BODY_PARAMETERS) |
| [INVALID_PARAMETER_COMBINATION](#INVALID_PARAMETER_COMBINATION) |
| [MISSING_PATH_PARAMETER_DEFINITION](#MISSING_PATH_PARAMETER_DEFINITION) |
| [MISSING_PATH_PARAMETER_DECLARATION](#MISSING_PATH_PARAMETER_DECLARATION) |
| [UNRESOLVABLE_REFERENCE](#UNRESOLVABLE_REFERENCE)| 
| [ANY_OF_MISSING](#ANY_OF_MISSING) |
| [ONE_OF_MISSING](#ONE_OF_MISSING) |
| [INVALID_REFERENCE](#INVALID_REFERENCE) |
| [OBJECT_MISSING_REQUIRED_PROPERTY](#OBJECT_MISSING_REQUIRED_PROPERTY) |
| [UNUSED_DEFINITION](#UNUSED_DEFINITION) |
| [DUPLICATE_PARAMETER](#DUPLICATE_PARAMETER) |
| [SEMANTIC_VALIDATION_ERROR](#DUPLICATE_PARAMETER) |
| [X-MS-EXAMPLE_NOTFOUND_ERROR](#X-MS-EXAMPLE_NOTFOUND_ERROR) |
| [SCHEMA_NOT_AN_OBJECT](#SCHEMA_NOT_AN_OBJECT) |
| [SCHEMA_NOT_REACHABLE](#SCHEMA_NOT_REACHABLE) |
| [SCHEMA_VALIDATION_FAILED](#SCHEMA_VALIDATION_FAILED) |
| [UNRESOLVABLE_REFERENCE](#UNRESOLVABLE_REFERENCE) |
| [UNKNOWN_FORMAT](#UNRESOLVABLE_REFERENCE) |

## Errors Descriptions

Errors from OAV validate-spec command will include:
  - Code: Unique identifier for the type of semantic error encountered
  - Message: Details about the issue
  - Path: Pointer to where the error/warning was detected

### <a name="EQUIVALENT_PATH"/> EQUIVALENT_PATH 

**Message**: Equivalent path already exists:  [path]

**Description**: Open API specification allows only unique paths.

**How to fix the issue**: Verify whether there are paths that are the same or that are parameterized in a way tha makes them equivalent. To fix the issue include all operations that share the same path under the same path section of the specification. 

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="OBJECT_MISSING_REQUIRED_PROPERTY_DEFINITION" />OBJECT_MISSING_REQUIRED_PROPERTY_DEFINITION 

**Message**: Missing required property definition: <property>

**Description**: Property indicated as required for the operation is missing its definition.  

**How to fix the issue**: Verify that the properties included in the 'required" array have all been defined. 

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="EMPTY_PATH_PARAMETER_DECLARATION" />EMPTY_PATH_PARAMETER_DECLARATION 

**Message**: Path parameter declaration cannot be empty: [parameter]

**Description**: Path paramater should be defined within the operation and not be empty.

**How to fix the issue**: Please verify that the all path parameters are defined for the operation and are not empty. 

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="DUPLICATE_OPERATIONID" />DUPLICATE_OPERATIONID 

**Message**: Cannot have multiple operations with the same operationId

**Description**: OperationIds must be unique within an OpenAPI specification.

**How to fix the issue**: Please verify that all operationIds are unique and update them if there are any duplicates.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="MULTIPLE_BODY_PARAMETERS" />MULTIPLE_BODY_PARAMETERS 

**Message**: Operation cannot have multiple body parameters

**Description**: Only one body parameter is allowed per operation.

**How to fix the issue**: Please check that there's only one parameter marked as body parameter ("in":"body").

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="INVALID_PARAMETER_COMBINATION" />INVALID_PARAMETER_COMBINATION 

**Message**: Operation cannot have a body parameter and a formData parameter 

**Description**: Either body parameter or formData parameter are allowed per operation.

**How to fix the issue**: Please check there's only a body or a formData paramater exclusively.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="MISSING_PATH_PARAMETER_DEFINITION" />MISSING_PATH_PARAMETER_DEFINITION 

**Message**: Path parameter is declared but is not defined: [parameter]

**Description**: Path parameter is included in path, but is not defined within the operation.

**How to fix the issue**: Please check that the parameter is defined within the operation.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="MISSING_PATH_PARAMETER_DECLARATION" />MISSING_PATH_PARAMETER_DECLARATION 

**Message**: Path parameter is defined but is not declared: [parameter]

**Description**: There's a paramater defined as "in":"path", but not used/declared in the path of the operation.

**How to fix the issue**: Verify if the parameter should be part of the path and add it, or remove it from the definitions. 

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="UNRESOLVABLE_REFERENCE" />UNRESOLVABLE_REFERENCE 

**Message**: Reference could not be resolved: [ref]

**Description**: Reference cannot be resolved, path not found or file does not exist.

**How to fix the issue**: Please check reference is valid.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="ANY_OF_MISSING" />ANY_OF_MISSING 

**Message**: Not a valid [def] definition.

**Description**: OpenAPI structure is missing a section/keyword. 

**How to fix the issue**: Please check that the defintion referenced is valid.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="ONE_OF_MISSING" />ONE_OF_MISSING 

**Message**: Not a valid [def] definition.

**Description**: OpenAPI structure is missing a section/keyword. 

**How to fix the issue**: Please check that the defintion referenced is valid.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="INVALID_REFERENCE" />INVALID_REFERENCE 

**Message**: Invalid JSON Reference | Specific error details.

**Description**: Reference is invalid.

**How to fix the issue**: Please check that the reference is valid.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="OBJECT_MISSING_REQUIRED_PROPERTY" />OBJECT_MISSING_REQUIRED_PROPERTY 

**Message**: Missing required property: [property]

**Description**: Property marked as required is missing in the operation.

**How to fix the issue**: Please specify the property that's indicated as required or remove it from being required.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="UNUSED_DEFINITION" />UNUSED_DEFINITION 

**Message**: Definition is not used: [definition].

**Description**: Definition is not referenced/used in the file. 

**How to fix the issue**: Please check if the definition is needed in the file, remove it if not needed or reference it appropriately.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="DUPLICATE_PARAMETER" />DUPLICATE_PARAMETER 

**Message**: Operation cannot have duplicate parameters: [parameter]

**Description**: Parameters should be unique for the operation. 

**How to fix the issue**: Please check there are no duplicate parameter names or rename as needed.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="X-MS-EXAMPLE_NOTFOUND_ERROR" />X-MS-EXAMPLE_NOTFOUND_ERROR

**Message**: Operation cannot have duplicate parameters: [parameter]

**Description**: Each operation should have example defined.

**How to fix the issue**: Add `x-ms-example`` declaration for this operation.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="SCHEMA_NOT_AN_OBJECT" />SCHEMA_NOT_AN_OBJECT

**Message**: Schema is not an object: [parameter]

**Description**: The schema type is expected to be object.

**How to fix the issue**: Correct the schema type.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="SCHEMA_NOT_REACHABLE" />SCHEMA_NOT_REACHABLE

**Message**: Validator was not able to schema with uri: [parameter]

**Description**: It fails to load the remote schema.

**How to fix the issue**: Fix the uri of remote schema or network issue.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="SCHEMA_VALIDATION_FAILED" />SCHEMA_VALIDATION_FAILED

**Message**: Schema failed to validate against its parent schema, see inner errors for details.

**Description**: The schema fails to validate against its parent schema.

**How to fix the issue**: Fix the schema by comparing against parent schema.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="UNRESOLVABLE_REFERENCE" />UNRESOLVABLE_REFERENCE

**Message**: Reference could not be resolved: [parameter]

**Description**: It fails to resolve the reference uri of a remote schema.

**How to fix the issue**:  Fix the uri.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 

### <a name="UNKNOWN_FORMAT" />UNKNOWN_FORMAT

**Message**: There is no validation function for format: [parameter]

**Description**: `oav` does not support format validation of this type.

**How to fix the issue**: Use another format or file an issue against azure/oav.

Links: [Index](#index) | [Error descriptions](#error-descriptions) 
