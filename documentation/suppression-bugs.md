# Suppression Bugs

## Invalid path `value/0/additionalInformation/additionalInformation/0/properties`

C:/github.com/Azure/azure-rest-api-specs/specification/adhybridhealthservice/resource-manager/Microsoft.ADHybridHealthService/stable/2014-01-01/ADHybridHealthService.json

Several hits.

```
operationId: alerts_listAddsAlerts
scenario: alerts_listAddsAlerts
source: response
responseCode: '200'
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - object
    - array
  message: Expected type object but found type array
  path: value/0/additionalInformation/additionalInformation/0/properties
  title: >-
    /definitions/generated.nested.definitions.AdditionalInformation.properties.properties
  description: The list of properties which are included in the additional information.
  position:
    line: 3301
    column: 23
  url: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/adhybridhealthservice/resource-manager/Microsoft.ADHybridHealthService/stable/2014-01-01/ADHybridHealthService.json
  directives: {}
  jsonUrl: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/adhybridhealthservice/resource-manager/Microsoft.ADHybridHealthService/stable/2014-01-01/examples/Alerts.json
```

## 2. No References

```
operationId: adDomainServiceMembers_list
scenario: adDomainServiceMembers_list
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - integer
    - string
  message: Expected type integer but found type string
  path: >-
    /providers/Microsoft.ADHybridHealthService/addsservices/{serviceName}/addomainservicemembers/takeCount
```

## 3. Bug

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/apimanagement/resource-manager/Microsoft.ApiManagement/preview/2018-06-01-preview/apimversionsets.json:

[json-schema-faker] calling JsonSchemaFaker() is deprecated, call either .generate() or .resolve()
[json-schema-faker] calling JsonSchemaFaker() is deprecated, call either .generate() or .resolve()
[json-schema-faker] calling JsonSchemaFaker() is deprecated, call either .generate() or .resolve()
[json-schema-faker] calling JsonSchemaFaker() is deprecated, call either .generate() or .resolve()
[json-schema-faker] calling JsonSchemaFaker() is deprecated, call either .generate() or .resolve()
[json-schema-faker] calling JsonSchemaFaker() is deprecated, call either .generate() or .resolve()
```

## 4. Path?

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/data-plane/microsoft.insights/preview/2018-04-20/swagger.json:

[31m error : [0m
operationId: Events_GetOdataMetadata
scenario: eventMetadata
source: response
responseCode: '200'
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - object
    - string
  message: Expected type object but found type string
  path: ''
```

## 5. Path ?

Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/data-plane/microsoft.insights/preview/v1/AppInsights.json:

[31m error : [0m
operationId: Events_GetOdataMetadata
scenario: eventMetadata
source: response
responseCode: '200'
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - object
    - string
  message: Expected type object but found type string
  path: ''

## 6.

```
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/preview/2017-10-01/componentFeaturesAndPricing_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/preview/2017-10-01/eaSubscriptionMigration_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/preview/2018-06-17-preview/workbookOperations_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/preview/2018-06-17-preview/workbooks_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/aiOperations_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/analyticsItems_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/componentAnnotations_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/componentApiKeys_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/componentContinuousExport_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/componentFeaturesAndPricing_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/componentProactiveDetection_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/components_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/componentWorkItemConfigs_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/favorites_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/webTestLocations_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/webTests_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/applicationinsights/resource-manager/Microsoft.Insights/stable/2015-05-01/workbooks_API.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
```

## 7. Path?

Several hits

```
[31m error : [0m
operationId: Job_GetOutput
scenario: Get Job Output
source: response
responseCode: '200'
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - file
    - string
  message: Expected type file but found type string
  path: ''
```

## 8. INVALID_CONTENT_TYPE

```
[31m error : [0m
operationId: Job_GetRunbookContent
scenario: Get Job Runbook Content
source: response
responseCode: '200'
severity: 1
errorCode: INVALID_CONTENT_TYPE
errorDetails:
  code: INVALID_CONTENT_TYPE
  message: >-
    Invalid Content-Type (text/powershell).  These are supported:
    application/json
  path: ''
```

## 9. Path

Several hits.

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/automation/resource-manager/Microsoft.Automation/stable/2015-10-31/dscCompilationJob.json:

[31m error : [0m
operationId: DscCompilationJob_GetStream
scenario: Get a DSC Compilation job stream by job stream id
source: response
responseCode: '200'
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - object
    - string
  message: Expected type object but found type string
  path: properties/value/value/value
  title: >-
    /definitions/generated.nested.definitions.JobStreamProperties.properties.value.additionalProperties
  position:
    line: 819
    column: 35
  url: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/automation/resource-manager/Microsoft.Automation/stable/2015-10-31/job.json
  directives: {}
  jsonUrl: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/automation/resource-manager/Microsoft.Automation/stable/2015-10-31/examples/compilationJobStreamByJobStreamId.json
```

## 10

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/automation/resource-manager/Microsoft.Automation/stable/2015-10-31/dscConfiguration.json:

[31m error : [0m
operationId: DscConfiguration_GetContent
scenario: Get DSC Configuration content
source: response
responseCode: '200'
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - file
    - string
  message: Expected type file but found type string
  path: ''
```

## 11

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/automation/resource-manager/Microsoft.Automation/stable/2015-10-31/job.json:

[31m error : [0m
operationId: Job_GetOutput
scenario: Get Job
source: response
responseCode: '200'
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  message: Expected type file but found type object
  path: ''
```

## 12

Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/automation/resource-manager/Microsoft.Automation/stable/2015-10-31/runbook.json:

Several hits

```
[31m error : [0m
operationId: RunbookDraft_GetContent
scenario: Get runbook draft content
source: response
responseCode: '200'
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - file
    - string
  message: Expected type file but found type string
  path: ''
```

## 13 RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/automation/resource-manager/Microsoft.Automation/stable/2015-10-31/runbook.json:

[31m error : [0m
operationId: RunbookDraft_ReplaceContent
scenario: Create or update runbook draft
source: response
responseCode: '200'
severity: 0
errorCode: RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE
errorDetails:
  code: RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE
  id: OAV111
  message: >-
    Following response status codes "200" for operation
    "RunbookDraft_ReplaceContent" were present in the swagger spec, however they
    were not present in x-ms-examples. Please provide them.
  innerErrors: !<tag:yaml.org,2002:js/undefined> ''
  level: error
```

## 14 INVALID_TYPE

Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/automation/resource-manager/Microsoft.Automation/stable/2018-01-15/dscCompilationJob.json:

```

```

## 15

Several hits

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/automation/resource-manager/Microsoft.Automation/stable/2018-06-30/runbook.json:

[31m error : [0m
operationId: RunbookDraft_GetContent
scenario: Get runbook draft content
source: response
responseCode: '200'
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - file
    - string
  message: Expected type file but found type string
  path: ''
```

## 16 RESPONSE_SCHEMA_NOT_IN_SPEC

```
[31m error : [0m
operationId: RunbookDraft_ReplaceContent
scenario: Create or update runbook draft
source: response
responseCode: '202'
severity: 0
errorCode: RESPONSE_SCHEMA_NOT_IN_SPEC
errorDetails:
  code: RESPONSE_SCHEMA_NOT_IN_SPEC
  id: OAV113
  message: >-
    Response statusCode "202" for operation "RunbookDraft_ReplaceContent" has
    response body provided in the example, however the response does not have a
    "schema" defined in the swagger spec.
  innerErrors: !<tag:yaml.org,2002:js/undefined> ''
  level: error
```

## 17 INVALID_CONTENT_TYPE

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/azurebridge/Microsoft.AzureBridge.Admin/preview/2016-01-01/AzureBridge.json:

[31m error : [0m
operationId: Operations_List
scenario: Returns the list of support REST operations.
source: response
responseCode: '200'
severity: 1
errorCode: INVALID_CONTENT_TYPE
errorDetails:
  code: INVALID_CONTENT_TYPE
  message: 'Invalid Content-Type (application/octet-stream).  These are supported: '
  path: ''
```

## 18

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/azurebridge/Microsoft.AzureBridge.Admin/preview/2016-01-01/DownloadedProduct.json:

[31m error : [0m
operationId: DownloadedProducts_Delete
scenario: Deletes the specified downloaded product.
source: response
responseCode: '200'
severity: 0
errorCode: RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE
errorDetails:
  code: RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE
  id: OAV111
  message: >-
    Following response status codes "200" for operation
    "DownloadedProducts_Delete" were present in the swagger spec, however they
    were not present in x-ms-examples. Please provide them.
  innerErrors: !<tag:yaml.org,2002:js/undefined> ''
  level: error
```

## 19

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/azurebridge/Microsoft.AzureBridge.Admin/preview/2016-01-01/Product.json:

[31m error : [0m
operationId: Products_Download
scenario: Return product name.
source: response
responseCode: '200'
severity: 0
errorCode: RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE
errorDetails:
  code: RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE
  id: OAV111
  message: >-
    Following response status codes "200" for operation "Products_Download" were
    present in the swagger spec, however they were not present in x-ms-examples.
    Please provide them.
  innerErrors: !<tag:yaml.org,2002:js/undefined> ''
  level: error
```

## 20 INVALID_FORMAT

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/compute/Microsoft.Compute.Admin/preview/2018-07-30-preview/Disks.json:

[31m error : [0m
operationId: Disks_List
scenario: Returns a list of disks.
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_FORMAT
errorDetails:
  code: INVALID_FORMAT
  params:
    - int32
    - '100'
  message: 'Object didn''t pass validation for format int32: 100'
  path: >-
    /subscriptions/{subscriptionId}/providers/Microsoft.Compute.Admin/locations/{location}/disks/count
  description: The maximum number of disks to return.
```

### 21 INVALID_TYPE & INVALID_FORMAT

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/compute/Microsoft.Compute.Admin/preview/2018-07-30-preview/Disks.json:

[31m error : [0m
operationId: Disks_List
scenario: Returns a list of disks.
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - integer
    - string
  message: Expected type integer but found type string
  path: >-
    /subscriptions/{subscriptionId}/providers/Microsoft.Compute.Admin/locations/{location}/disks/count

  [31m error : [0m
operationId: Disks_List
scenario: Returns a list of disks.
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_FORMAT
errorDetails:
  code: INVALID_FORMAT
  params:
    - int32
    - '1'
  message: 'Object didn''t pass validation for format int32: 1'
  path: >-
    /subscriptions/{subscriptionId}/providers/Microsoft.Compute.Admin/locations/{location}/disks/start
  description: The start index of disks in query.
```

### INVALID_TYPE

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/fabric/Microsoft.Fabric.Admin/preview/2016-05-01/IpPool.json:

[31m error : [0m
operationId: IpPools_CreateOrUpdate
scenario: Create an IP pool.  Once created an IP pool cannot be deleted.
source: response
responseCode: '202'
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - object
    - undefined
  message: Expected type object but found type undefined
  path: ''
  title: /definitions/IpPool
  description: >-
    This resource defines the range of IP addresses from which addresses are
    allocated for nodes within a subnet.
  position:
    line: 156
    column: 19
  url: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/fabric/Microsoft.Fabric.Admin/preview/2016-05-01/IpPool.json
  directives: {}
```

### INVALID_TYPE & INVALID_FORMAT

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/storage/Microsoft.Storage.Admin/preview/2016-05-01/containers.json:

[31m error : [0m
operationId: Containers_List
scenario: Returns the list of containers which can be migrated in the specified share.
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_FORMAT
errorDetails:
  code: INVALID_FORMAT
  params:
    - int32
    - '0'
  message: 'Object didn''t pass validation for format int32: 0'
  path: >-
    /subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Storage.Admin/farms/{farmId}/shares/{shareName}/containers/StartIndex
  description: The starting index the resource provider uses.

[31m error : [0m
operationId: Containers_List
scenario: Returns the list of containers which can be migrated in the specified share.
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - integer
    - string
  message: Expected type integer but found type string
  path: >-
    /subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/Microsoft.Storage.Admin/farms/{farmId}/shares/{shareName}/containers/StartIndex
```

## 21 Critical!

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/storage/Microsoft.Storage.Admin/preview/2016-05-01/tableServices.json:

error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/subscriptions/Microsoft.Subscriptions.Admin/preview/2015-11-01/AcquiredPlan.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/subscriptions/Microsoft.Subscriptions.Admin/preview/2015-11-01/DelegatedProvider.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/subscriptions/Microsoft.Subscriptions.Admin/preview/2015-11-01/DelegatedProviderOffer.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/subscriptions/Microsoft.Subscriptions.Admin/preview/2015-11-01/DirectoryTenant.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/subscriptions/Microsoft.Subscriptions.Admin/preview/2015-11-01/Location.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/subscriptions/Microsoft.Subscriptions.Admin/preview/2015-11-01/Offer.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/subscriptions/Microsoft.Subscriptions.Admin/preview/2015-11-01/OfferDelegation.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/subscriptions/Microsoft.Subscriptions.Admin/preview/2015-11-01/Plan.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/subscriptions/Microsoft.Subscriptions.Admin/preview/2015-11-01/Quota.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/subscriptions/Microsoft.Subscriptions.Admin/preview/2015-11-01/Subscriptions.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
```

## 22 Critical!

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/update/Microsoft.Update.Admin/preview/2016-05-01/Updates.json:

error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/user-subscriptions/Microsoft.Subscriptions/preview/2015-11-01/Offer.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"Unable to read the content or execute \"JSON.parse()\" on the content of file \"C:/github.com/Azure/azure-rest-api-specs/specification/azsadmin/resource-manager/user-subscriptions/Microsoft.Subscriptions/preview/2015-11-01/Subscriptions.json\". The error is:\nTypeError: this._input.match is not a function","innerErrors":[{}],"level":"error"}
```

## 23 INVALID_TYPE

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/batch/data-plane/Microsoft.Batch/stable/2017-01-01.4.0/BatchService.json:

[31m error : [0m
operationId: File_DeleteFromTask
scenario: File delete from task
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - boolean
    - string
  message: Expected type boolean but found type string
  path: '/jobs/{jobId}/tasks/{taskId}/files/{filePath}/recursive'
```

## 24 INVALID_TYPE

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/batch/data-plane/Microsoft.Batch/stable/2017-05-01.5.0/BatchService.json:

[31m error : [0m
operationId: File_DeleteFromTask
scenario: File delete from task
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - boolean
    - string
  message: Expected type boolean but found type string
  path: '/jobs/{jobId}/tasks/{taskId}/files/{filePath}/recursive'
```

## 25 OBJECT_ADDITIONAL_PROPERTIES

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/batch/data-plane/Microsoft.Batch/stable/2017-05-01.5.0/BatchService.json:

[31m error : [0m
operationId: JobSchedule_Add
scenario: Add a complex JobScheduleAdd
source: request
responseCode: ALL
severity: 0
errorCode: OBJECT_ADDITIONAL_PROPERTIES
errorDetails:
  code: OBJECT_ADDITIONAL_PROPERTIES
  params:
    - - targetDedicated
  message: 'Additional properties not allowed: targetDedicated'
  path: jobSpecification/poolInfo/autoPoolSpecification/pool
  title: /definitions/PoolSpecification
  position:
    line: 11357
    column: 26
  url: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/batch/data-plane/Microsoft.Batch/stable/2017-05-01.5.0/BatchService.json
  directives: {}
```

## 26

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/batch/data-plane/Microsoft.Batch/stable/2017-06-01.5.1/BatchService.json:

[31m error : [0m
operationId: File_DeleteFromTask
scenario: File delete from task
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - boolean
    - string
  message: Expected type boolean but found type string
  path: '/jobs/{jobId}/tasks/{taskId}/files/{filePath}/recursive'
```

## 27

```

Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/batch/data-plane/Microsoft.Batch/stable/2017-09-01.6.0/BatchService.json:

[31m error : [0m
operationId: File_DeleteFromTask
scenario: File delete from task
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - boolean
    - string
  message: Expected type boolean but found type string
  path: '/jobs/{jobId}/tasks/{taskId}/files/{filePath}/recursive'
```

## 28

Several hits.

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/batch/data-plane/Microsoft.Batch/stable/2018-03-01.6.1/BatchService.json:

[31m error : [0m
operationId: Account_ListPoolNodeCounts
scenario: NodeCountsPayload
source: response
responseCode: '200'
severity: 0
errorCode: OBJECT_MISSING_REQUIRED_PROPERTY
errorDetails:
  code: OBJECT_MISSING_REQUIRED_PROPERTY
  params:
    - leavingPool
  message: 'Missing required property: leavingPool'
  path: value/0/dedicated
  title: /definitions/NodeCounts
  similarPaths:
    - value/1/dedicated
    - value/2/dedicated
  position:
    line: 15835
    column: 19
  url: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/batch/data-plane/Microsoft.Batch/stable/2018-03-01.6.1/BatchService.json
  directives: {}
  jsonPosition:
    line: 13
    column: 26
  jsonUrl: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/batch/data-plane/Microsoft.Batch/stable/2018-03-01.6.1/examples/AccountListPoolNodeCounts.json
```

## 29 Critical

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/batch/data-plane/Microsoft.Batch/stable/2018-08-01.7.0/BatchService.json:

error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"p.split is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"p.split is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"p.split is not a function","innerErrors":[{}],"level":"error"}
error: {"code":"RESOLVE_SPEC_ERROR","id":"OAV102","message":"p.split is not a function","innerErrors":[{}],"level":"error"}
```

## 30 INVALID_TYPE

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/billing/resource-manager/Microsoft.Billing/preview/2017-02-27-preview/billing.json:

[31m error : [0m
operationId: Invoices_List
scenario: InvoicesExpand
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - integer
    - string
  message: Expected type integer but found type string
  path: '/subscriptions/{subscriptionId}/providers/Microsoft.Billing/invoices/$top'
```

## 31 INVALID_TYPE

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/billing/resource-manager/Microsoft.Billing/preview/2017-04-24-preview/billing.json:

[31m error : [0m
operationId: Invoices_List
scenario: InvoicesExpand
source: request
responseCode: ALL
severity: 0
errorCode: INVALID_TYPE
errorDetails:
  code: INVALID_TYPE
  params:
    - integer
    - string
  message: Expected type integer but found type string
  path: '/subscriptions/{subscriptionId}/providers/Microsoft.Billing/invoices/$top'
```

### 32 ONE_OF_MISSING

Multiple hits

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/blueprint/resource-manager/Microsoft.Blueprint/preview/2017-11-11-preview/blueprint.json:

[31m error : [0m
operationId: Artifacts_CreateOrUpdate
scenario: ARMTemplateArtifact
source: request
responseCode: ALL
severity: 0
errorCode: ONE_OF_MISSING
errorDetails:
  code: ONE_OF_MISSING
  params: []
  message: Data does not match any schemas from 'oneOf'
  path: ''
  inner:
    - code: OBJECT_ADDITIONAL_PROPERTIES
      params:
        - - properties
      message: 'Additional properties not allowed: properties'
      path: ''
      title: /definitions/Artifact
      description: Represents a Blueprint artifact.
      position:
        line: 762
        column: 17
      url: >-
        C:/github.com/Azure/azure-rest-api-specs/specification/blueprint/resource-manager/Microsoft.Blueprint/preview/2017-11-11-preview/blueprint.json
      directives:
        R3006: true
        R3026: true
    - code: OBJECT_ADDITIONAL_PROPERTIES
      params:
        - - value
      message: 'Additional properties not allowed: value'
      path: properties/parameters/storageAccountType
      title: /definitions/ParameterValueBase
      description: Base class for ParameterValue.
      position:
        line: 1307
        column: 27
      url: >-
        C:/github.com/Azure/azure-rest-api-specs/specification/blueprint/resource-manager/Microsoft.Blueprint/preview/2017-11-11-preview/blueprint.json
      directives:
        R3006: true
        R3026: true
    - code: OBJECT_ADDITIONAL_PROPERTIES
      params:
        - - parameters
          - template
      message: 'Additional properties not allowed: parameters,template'
      path: properties
      title: /definitions/RoleAssignmentArtifactProperties
      description: Properties of the Role assignment artifact.
      position:
        line: 1199
        column: 41
      url: >-
        C:/github.com/Azure/azure-rest-api-specs/specification/blueprint/resource-manager/Microsoft.Blueprint/preview/2017-11-11-preview/blueprint.json
      directives:
        R3006: true
        R3026: true
    - code: OBJECT_ADDITIONAL_PROPERTIES
      params:
        - - template
      message: 'Additional properties not allowed: template'
      path: properties
      title: /definitions/PolicyAssignmentArtifactProperties
      description: PolicyAssignment properties
      position:
        line: 1248
        column: 43
      url: >-
        C:/github.com/Azure/azure-rest-api-specs/specification/blueprint/resource-manager/Microsoft.Blueprint/preview/2017-11-11-preview/blueprint.json
      directives:
        R3006: true
        R3026: true
```

## 33

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/cdn/resource-manager/Microsoft.Cdn/stable/2017-04-02/cdn.json:

[31m error : [0m
operationId: Profiles_Get
scenario: Profiles_Get
source: response
responseCode: '200'
severity: 0
errorCode: OBJECT_ADDITIONAL_PROPERTIES
errorDetails:
  code: OBJECT_ADDITIONAL_PROPERTIES
  params:
    - - value
  message: 'Additional properties not allowed: value'
  path: ''
  title: /definitions/Profile
  description: >-
    CDN profile is a logical grouping of endpoints that share the same settings,
    such as CDN provider and pricing tier.
  position:
    line: 1911
    column: 16
  url: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/cdn/resource-manager/Microsoft.Cdn/stable/2017-04-02/cdn.json
  directives: {}
  jsonUrl: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/cdn/resource-manager/Microsoft.Cdn/stable/2017-04-02/examples/Profiles_Get.json
```

## 34

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/cdn/resource-manager/Microsoft.Cdn/stable/2017-04-02/cdn.json:

[31m error : [0m
operationId: Profiles_Get
scenario: Profiles_Get
source: response
responseCode: '200'
severity: 0
errorCode: OBJECT_ADDITIONAL_PROPERTIES
errorDetails:
  code: OBJECT_ADDITIONAL_PROPERTIES
  params:
    - - value
  message: 'Additional properties not allowed: value'
  path: ''
  title: /definitions/Profile
  description: >-
    CDN profile is a logical grouping of endpoints that share the same settings,
    such as CDN provider and pricing tier.
  position:
    line: 1911
    column: 16
  url: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/cdn/resource-manager/Microsoft.Cdn/stable/2017-04-02/cdn.json
  directives: {}
  jsonUrl: >-
    C:/github.com/Azure/azure-rest-api-specs/specification/cdn/resource-manager/Microsoft.Cdn/stable/2017-04-02/examples/Profiles_Get.json
```

## 35

```
Validating "examples" and "x-ms-examples" in  C:/github.com/Azure/azure-rest-api-specs/specification/cdn/resource-manager/Microsoft.Cdn/stable/2017-04-02/cdn.json:

[31m error : [0m
operationId: Profiles_Create
scenario: Profiles_Create
source: response
responseCode: '200'
severity: 0
errorCode: RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE
errorDetails:
  code: RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE
  id: OAV111
  message: >-
    Following response status codes "200,202" for operation "Profiles_Create"
    were present in the swagger spec, however they were not present in
    x-ms-examples. Please provide them.
  innerErrors: !<tag:yaml.org,2002:js/undefined> ''
  level: error

[31m error : [0m
operationId: Profiles_Delete
scenario: Profiles_Delete
source: response
responseCode: '202'
severity: 0
errorCode: RESPONSE_SCHEMA_NOT_IN_SPEC
errorDetails:
  code: RESPONSE_SCHEMA_NOT_IN_SPEC
  id: OAV113
  message: >-
    Response statusCode "202" for operation "Profiles_Delete" has response body
    provided in the example, however the response does not have a "schema"
    defined in the swagger spec.
  innerErrors: !<tag:yaml.org,2002:js/undefined> ''
  level: error
```

