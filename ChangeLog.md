# Changelog

### 08/14/2018 0.4.69

- Collaps of similar errors for array elements in `similarPaths` property on the error.

### 08/13/2018 0.4.68

- Using a JSON parser with a source map.

### 08/11/2018 0.4.67

- Single error for not matching any discriminated types.

### 08/10/2018 0.4.66

- Use JSON Pointer format for inserted schema title for properties and definitions.

### 08/10/2018 0.4.65

- Include property name as schema title in the property object.

### 08/10/2018 0.4.64

- Include definition name as schema title in the definitions.

### 08/01/2018 0.4.63

- Replacing `reduce` error collections with lazy iterators.

### 07/18/2018 0.4.62

- Solve security vulnerabilities

### 07/18/2018 0.4.61

- Export more types

### 07/18/2018 0.4.60

- Use `yasway` type definitions

### 07/18/2018 0.4.59

- Bug fix: `scenarios is undefined` when running AutoRest plugin.

### 07/17/2018 0.4.58

- export additional types.

### 07/05/2018 0.4.57

- `--pretty` output.

### 07/05/2018 0.4.56

- Error serialization.

### 07/05/2018 0.4.55

- Remove a dependency on `@types/winston` package. `winston` is updated to `3.0.0`.

### 06/21/2018 0.4.54

- Apply rules for Nested Properties

### 06/26/2018 0.4.51

- Bug fix: Do BOM stripping for remote URL's [#266](https://github.com/Azure/oav/issues/266).

### 06/20/2018 0.4.50

- Replace sway dependency with yasway.

### 06/19/2018 0.4.49

- Bug fix: Data is valid against more than one schema from `oneOf` [#248](https://github.com/Azure/oav/pull/248)
  The problem occurs when referenced model may also accept `null`. The fix is replacing `oneOf` with `anyOf`.

### 05/14/2018 0.4.38

- Bug fix: `oav extract-xmsexamples` also extracts request headers. [#241](https://github.com/Azure/oav/pull/241)
- Bug fix: x-ms-parametrized-host is not validated correctly [#240](https://github.com/Azure/oav/issues/240)

### 04/23/2018 0.4.37

- Update dependencies.
- Bug fixes: [#238](https://github.com/Azure/oav/pull/238)
  - Path parameters can include single quotes and be evaluated succesfully.
  - Enums with non-string values are properly evaluated.

### 04/19/2018 0.4.36

- If enums mismatch only in casing the new error ENUM_CASE_MISMATCH will be returned.

### 03/15/2018 0.4.35

- Validate default responses. [#228](https://github.com/Azure/oav/issues/228)
- Add option to model an implicit default cloud error response. [#224](https://github.com/Azure/oav/issues/224)

### 03/08/2018 0.4.34

- Updating default output level to info.
- Fixing issue #225, where output verbosity wasn't respected in one case.

### 02/28/2018 0.4.33

- Don't validate pure objects.

### 02/05/2018 0.4.32

- Fix bug for resolve external references introduced part of #202.

### 02/05/2018 0.4.31

- Bug fix for the fix made to resolve jshint issues in #202.

### 02/05/2018 0.4.30

- Improve matching for status code string for live validation.

### 02/05/2018 0.4.29

- Add support for live validation to support status code string along the status code number.
- Update to use package autorest-extension-base from npm.

### 02/01/2018 0.4.28

- Fix undefined headers issue when the spec does not define consumes values.

### 01/31/2018 0.4.27

- Updating dependency of lodash to 4.17.4.

### 01/31/2018 0.4.26

- Fix all linter issues. [#201](https://github.com/Azure/oav/issues/201)
- Add option to do case insensitive regex matches on swagger paths to the SpecValidator and LiveValidator. [#203](https://github.com/Azure/oav/issues/203)

### 01/30/2018 0.4.25

- Fixed a typo in the variable name while resolving nullable types.

### 01/17/2018 0.4.24

- The tool does not error on missing definitions in the swagger spec #194
- Added support for application/octet-stream or file upload/download scenarios #192

### 01/05/2018 0.4.23

- Addressing INVALID_TYPE issues reported by model validation due to nullable types/properties. [#155](https://github.com/Azure/oav/issues/155). In order to allow null types, we relax types to be 'oneOf' `null` or its type, for the cases where properties/models have x-nullable set or x-nullable is not defined and property is not required.

### 12/11/2017 0.4.22

- Added support to generate class diagram from a given swagger spec #188.
- Fixed #190, #191.

### 12/4/2017 0.4.21

- Removed the enum constraint or reference to an enum on the discriminator property if previously present before making it a constant.

### 11/20/2017 0.4.20

- Added support for processing [`"x-ms-parameterized-host": {}`](https://github.com/Azure/autorest/tree/master/docs/extensions#x-ms-parameterized-host) extension if present in the 2.0 swagger spec.

### 11/19/2017 0.4.19

- Added support for validating examples for parameters `"in": "formData"`.

### 11/09/2017 0.4.18

- Ensure scheme, host and basePath are used to construct the base url #180.

### 10/24/2017 0.4.17

- Disable resolving discriminators while performing semantic validation for an open api specification that conforms to 2.0 version.

### 10/20/2017 0.4.16

- Entire tree except the leaf nodes need to be traversed for replacing references of (an uber(root) or intermediate) parent with a `"oneof"` array containing references to itself and all its children. #175

### 10/18/2017 0.4.15

- Updating model validator to resolve polymorphic types using oneOf. #171

### 10/17/2017 0.4.14

- Updating model validator to plugin to autorest.

### 09/12/2017 0.4.13

- Provide the filepath of the file that has an incorrect json. This makes it easy for customers to find out the faulty file among numerous files.

### 09/12/2017 0.4.12

- [Model Validator] Should handle forward slashes in path parameters. #165
- [Model Validator] Should handle question mark in paths that are defined in x-ms-paths. #140

### 08/30/2017 0.4.11

- [Wire Format Generator] Should handle resolved x-ms-examples. #161

### 08/23/2017 0.4.10

- [Wire Format Generator] Removed condition for checking 200 & 204 in final status code for non-LRO. #159
- [Wire Format Generator] Updated default directory to be the api-version folder of the swagger spec. #159

### 08/03/2017 0.4.9

- [Live Validator] Shallow clone the azure-rest-api-spec repo.
- [Model Validator] Improve pluggability of oav into vs-code. #143

### 08/03/2017 0.4.8

- [Live Validator] Before cloning the rest api specs repo if directory named 'repo' exists we delete it and then create an empty directory to clone repo inside it.

### 07/11/2017 0.4.7

- Fixed Live validator for reorg branch of azure-rest-api-specs #137

### 07/03/2017 0.4.6

- Fixed issue #134

### 06/26/2017 0.4.5

- Added support to generate wireformat as a YAML doc
- Improved the format to specify request body for a in a request using curl.
