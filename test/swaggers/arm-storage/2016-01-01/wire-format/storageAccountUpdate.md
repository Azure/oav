## Request

```http
PATCH https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 24
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 841370b3-d212-478b-bdd4-9a45939142c8
host: management.azure.com
Connection: close

{"tags":{"tag1":"val1"}}
```

## Curl

```bash
curl -X PATCH 'https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \ 
-H 'Content-Length: 24' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 841370b3-d212-478b-bdd4-9a45939142c8' \
-d { \
  "tags": { \
    "tag1": "val1" \
  } \
}
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 260bdff5-675d-4eaf-abe2-1e70b35e1163
x-ms-correlation-request-id: 260bdff5-675d-4eaf-abe2-1e70b35e1163
x-ms-routing-request-id: WESTUS2:20170429T031120348Z:260bdff5-675d-4eaf-abe2-1e70b35e1163
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 782
content-type: application/json
Date: Sat, 29 Apr 2017 03:11:20 GMT
Connection: close

{"id":"/subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/rubysdktest_azure_mgmt_storage/providers/Microsoft.Storage/storageAccounts/storage3b8b8f628a1c4d868","kind":"Storage","location":"westus","name":"storage3b8b8f628a1c4d868","properties":{"creationTime":"2016-05-19T18:35:27.5236635Z","primaryEndpoints":{"blob":"https://storage3b8b8f628a1c4d868.blob.core.windows.net/","file":"https://storage3b8b8f628a1c4d868.file.core.windows.net/","queue":"https://storage3b8b8f628a1c4d868.queue.core.windows.net/","table":"https://storage3b8b8f628a1c4d868.table.core.windows.net/"},"primaryLocation":"westus","provisioningState":"Succeeded","statusOfPrimary":"available"},"sku":{"name":"Standard_LRS","tier":"Standard"},"tags":{"tag1":"val1"},"type":"Microsoft.Storage/storageAccounts"}
```
