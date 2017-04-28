## Request

```http
PUT https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 84
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: eb8cafd7-b761-4cd9-885e-7b1f38423e8f
host: management.azure.com
Connection: close

{"sku":{"name":"Standard_LRS"},"kind":"Storage","location":"westus","properties":{}}
```

## Initial Response

#### StatusCode: 202

```http
HTTP 1.1 202
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: dde6336c-46e2-4d51-9fe3-99a7abe22391
x-ms-correlation-request-id: dde6336c-46e2-4d51-9fe3-99a7abe22391
x-ms-routing-request-id: WESTUS2:20170428T104557791Z:dde6336c-46e2-4d51-9fe3-99a7abe22391
Strict-Transport-Security: max-age=31536000; includeSubDomains
location: https://management.azure.com/subscriptions/<AZURE_SUBSCRIPTION_ID>/providers/Microsoft.Storage/operations/337358c9-9644-4b6c-a652-542a0295601d?monitor=true&api-version=2016-01-01
content-type: application/json
Date: Fri, 28 Apr 2017 10:45:57 GMT
Connection: close


```

## Final Response after polling is complete and successful

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 2c11b789-f59f-4f23-9aab-429ce092ec4d
x-ms-correlation-request-id: 2c11b789-f59f-4f23-9aab-429ce092ec4d
x-ms-routing-request-id: WESTUS2:20170428T104557791Z:2c11b789-f59f-4f23-9aab-429ce092ec4d
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 769
content-type: application/json
Date: Fri, 28 Apr 2017 10:45:57 GMT
Connection: close

{"id":"/subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/rubysdktest_azure_mgmt_storage/providers/Microsoft.Storage/storageAccounts/storage56e236d65ef043378","kind":"Storage","location":"westus","name":"storage56e236d65ef043378","properties":{"creationTime":"2016-05-19T18:03:45.4141415Z","primaryEndpoints":{"blob":"https://storage56e236d65ef043378.blob.core.windows.net/","file":"https://storage56e236d65ef043378.file.core.windows.net/","queue":"https://storage56e236d65ef043378.queue.core.windows.net/","table":"https://storage56e236d65ef043378.table.core.windows.net/"},"primaryLocation":"westus","provisioningState":"Succeeded","statusOfPrimary":"available"},"sku":{"name":"Standard_LRS","tier":"Standard"},"tags":{},"type":"Microsoft.Storage/storageAccounts"}
```
