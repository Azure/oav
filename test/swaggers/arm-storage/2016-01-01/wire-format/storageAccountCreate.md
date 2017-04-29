## Request

```http
PUT https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 84
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 4dc4816f-df70-495f-a25a-6e5c4dcd9d89
host: management.azure.com
Connection: close

{"sku":{"name":"Standard_LRS"},"kind":"Storage","location":"westus","properties":{}}
```

## Curl

```bash
curl -X PUT 'https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \ 
-H 'Content-Length: 84' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 4dc4816f-df70-495f-a25a-6e5c4dcd9d89' \
-d { \
  "sku": { \
    "name": "Standard_LRS" \
  }, \
  "kind": "Storage", \
  "location": "westus", \
  "properties": {} \
}
```

## Initial Response

#### StatusCode: 202

```http
HTTP 1.1 202
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 9455a81a-f285-4052-863f-d215e2587a1b
x-ms-correlation-request-id: 9455a81a-f285-4052-863f-d215e2587a1b
x-ms-routing-request-id: WESTUS2:20170429T031120335Z:9455a81a-f285-4052-863f-d215e2587a1b
Strict-Transport-Security: max-age=31536000; includeSubDomains
location: https://management.azure.com/subscriptions/<AZURE_SUBSCRIPTION_ID>/providers/Microsoft.Storage/operations/337358c9-9644-4b6c-a652-542a0295601d?monitor=true&api-version=2016-01-01
content-type: application/json
Date: Sat, 29 Apr 2017 03:11:20 GMT
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
x-ms-request-id: 951b3e54-2de6-4e9e-9bba-9036af8cf4b0
x-ms-correlation-request-id: 951b3e54-2de6-4e9e-9bba-9036af8cf4b0
x-ms-routing-request-id: WESTUS2:20170429T031120335Z:951b3e54-2de6-4e9e-9bba-9036af8cf4b0
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 769
content-type: application/json
Date: Sat, 29 Apr 2017 03:11:20 GMT
Connection: close

{"id":"/subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/rubysdktest_azure_mgmt_storage/providers/Microsoft.Storage/storageAccounts/storage56e236d65ef043378","kind":"Storage","location":"westus","name":"storage56e236d65ef043378","properties":{"creationTime":"2016-05-19T18:03:45.4141415Z","primaryEndpoints":{"blob":"https://storage56e236d65ef043378.blob.core.windows.net/","file":"https://storage56e236d65ef043378.file.core.windows.net/","queue":"https://storage56e236d65ef043378.queue.core.windows.net/","table":"https://storage56e236d65ef043378.table.core.windows.net/"},"primaryLocation":"westus","provisioningState":"Succeeded","statusOfPrimary":"available"},"sku":{"name":"Standard_LRS","tier":"Standard"},"tags":{},"type":"Microsoft.Storage/storageAccounts"}
```
