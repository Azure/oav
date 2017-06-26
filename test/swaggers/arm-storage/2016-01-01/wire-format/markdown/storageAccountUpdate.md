## Request

```http
PATCH https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 24
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: cafb64cf-bc41-4c3a-8c6a-61544d8d752c
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
-H 'x-ms-client-request-id: cafb64cf-bc41-4c3a-8c6a-61544d8d752c' \
-d @- << EOF
{
  "tags": {
    "tag1": "val1"
  }
}
EOF
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 7da11c97-fcaf-4ed3-bd64-d2bd988e5f7d
x-ms-correlation-request-id: 7da11c97-fcaf-4ed3-bd64-d2bd988e5f7d
x-ms-routing-request-id: WESTUS2:20170626T175630023Z:7da11c97-fcaf-4ed3-bd64-d2bd988e5f7d
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 782
content-type: application/json
Date: Mon, 26 Jun 2017 17:56:30 GMT
Connection: close

{"id":"/subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/rubysdktest_azure_mgmt_storage/providers/Microsoft.Storage/storageAccounts/storage3b8b8f628a1c4d868","kind":"Storage","location":"westus","name":"storage3b8b8f628a1c4d868","properties":{"creationTime":"2016-05-19T18:35:27.5236635Z","primaryEndpoints":{"blob":"https://storage3b8b8f628a1c4d868.blob.core.windows.net/","file":"https://storage3b8b8f628a1c4d868.file.core.windows.net/","queue":"https://storage3b8b8f628a1c4d868.queue.core.windows.net/","table":"https://storage3b8b8f628a1c4d868.table.core.windows.net/"},"primaryLocation":"westus","provisioningState":"Succeeded","statusOfPrimary":"available"},"sku":{"name":"Standard_LRS","tier":"Standard"},"tags":{"tag1":"val1"},"type":"Microsoft.Storage/storageAccounts"}
```
