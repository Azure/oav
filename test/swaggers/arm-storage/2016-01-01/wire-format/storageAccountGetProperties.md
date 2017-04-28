## Request

```http
GET https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 9029ebb7-9641-4620-a6ca-e019386d7956
host: management.azure.com
Connection: close


```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 2bef47eb-97e9-4a54-bc05-38e20ffeae64
x-ms-correlation-request-id: 2bef47eb-97e9-4a54-bc05-38e20ffeae64
x-ms-routing-request-id: WESTUS2:20170428T104557791Z:2bef47eb-97e9-4a54-bc05-38e20ffeae64
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 769
content-type: application/json
Date: Fri, 28 Apr 2017 10:45:57 GMT
Connection: close

{"id":"/subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/rubysdktest_azure_mgmt_storage/providers/Microsoft.Storage/storageAccounts/storage8acbcd443ca040968","kind":"Storage","location":"westus","name":"storage8acbcd443ca040968","properties":{"creationTime":"2016-05-19T18:12:30.8044876Z","primaryEndpoints":{"blob":"https://storage8acbcd443ca040968.blob.core.windows.net/","file":"https://storage8acbcd443ca040968.file.core.windows.net/","queue":"https://storage8acbcd443ca040968.queue.core.windows.net/","table":"https://storage8acbcd443ca040968.table.core.windows.net/"},"primaryLocation":"westus","provisioningState":"Succeeded","statusOfPrimary":"available"},"sku":{"name":"Standard_LRS","tier":"Standard"},"tags":{},"type":"Microsoft.Storage/storageAccounts"}
```
