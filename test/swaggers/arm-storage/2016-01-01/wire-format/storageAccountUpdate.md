## Request

```http
PATCH https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 24
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: ed877c62-d2aa-4a4c-94e1-795696e5c3ad
host: management.azure.com
Connection: close

{"tags":{"tag1":"val1"}}
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 712d2edc-96b8-4aa3-9132-8de1c6cdcc60
x-ms-correlation-request-id: 712d2edc-96b8-4aa3-9132-8de1c6cdcc60
x-ms-routing-request-id: WESTUS2:20170428T104557807Z:712d2edc-96b8-4aa3-9132-8de1c6cdcc60
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 782
content-type: application/json
Date: Fri, 28 Apr 2017 10:45:57 GMT
Connection: close

{"id":"/subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/rubysdktest_azure_mgmt_storage/providers/Microsoft.Storage/storageAccounts/storage3b8b8f628a1c4d868","kind":"Storage","location":"westus","name":"storage3b8b8f628a1c4d868","properties":{"creationTime":"2016-05-19T18:35:27.5236635Z","primaryEndpoints":{"blob":"https://storage3b8b8f628a1c4d868.blob.core.windows.net/","file":"https://storage3b8b8f628a1c4d868.file.core.windows.net/","queue":"https://storage3b8b8f628a1c4d868.queue.core.windows.net/","table":"https://storage3b8b8f628a1c4d868.table.core.windows.net/"},"primaryLocation":"westus","provisioningState":"Succeeded","statusOfPrimary":"available"},"sku":{"name":"Standard_LRS","tier":"Standard"},"tags":{"tag1":"val1"},"type":"Microsoft.Storage/storageAccounts"}
```
