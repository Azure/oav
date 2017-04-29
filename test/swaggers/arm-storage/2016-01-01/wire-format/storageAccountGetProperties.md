## Request

```http
GET https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 823d25ad-cc70-41b5-a4e1-5ed7a9a37f39
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X GET 'https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 823d25ad-cc70-41b5-a4e1-5ed7a9a37f39' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 5abf6bf5-21e5-484e-ab7e-e29473cc5295
x-ms-correlation-request-id: 5abf6bf5-21e5-484e-ab7e-e29473cc5295
x-ms-routing-request-id: WESTUS2:20170429T031120345Z:5abf6bf5-21e5-484e-ab7e-e29473cc5295
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 769
content-type: application/json
Date: Sat, 29 Apr 2017 03:11:20 GMT
Connection: close

{"id":"/subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/rubysdktest_azure_mgmt_storage/providers/Microsoft.Storage/storageAccounts/storage8acbcd443ca040968","kind":"Storage","location":"westus","name":"storage8acbcd443ca040968","properties":{"creationTime":"2016-05-19T18:12:30.8044876Z","primaryEndpoints":{"blob":"https://storage8acbcd443ca040968.blob.core.windows.net/","file":"https://storage8acbcd443ca040968.file.core.windows.net/","queue":"https://storage8acbcd443ca040968.queue.core.windows.net/","table":"https://storage8acbcd443ca040968.table.core.windows.net/"},"primaryLocation":"westus","provisioningState":"Succeeded","statusOfPrimary":"available"},"sku":{"name":"Standard_LRS","tier":"Standard"},"tags":{},"type":"Microsoft.Storage/storageAccounts"}
```
