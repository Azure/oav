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
