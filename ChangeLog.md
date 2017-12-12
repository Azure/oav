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
