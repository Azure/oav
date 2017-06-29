## Request

```http
GET https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/storageAccounts?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 58437b1d-4ebc-4fe8-b20d-0650940f2c3b
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X GET 'https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/storageAccounts?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 58437b1d-4ebc-4fe8-b20d-0650940f2c3b' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 78e06177-4c77-458d-b8d7-1585cc104ba4
x-ms-correlation-request-id: 78e06177-4c77-458d-b8d7-1585cc104ba4
x-ms-routing-request-id: WESTUS2:20170628T164714978Z:78e06177-4c77-458d-b8d7-1585cc104ba4
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 1994
content-type: application/json
Date: Wed, 28 Jun 2017 16:47:14 GMT
Connection: close

{"value":[{"id":"/subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/vishrutrg/providers/Microsoft.Storage/storageAccounts/vishrutrg","kind":"Storage","location":"westus","name":"vishrutrg","properties":{"creationTime":"2016-03-18T01:58:17.4992360Z","primaryEndpoints":{"blob":"https://vishrutrg.blob.core.windows.net/","file":"https://vishrutrg.file.core.windows.net/","queue":"https://vishrutrg.queue.core.windows.net/","table":"https://vishrutrg.table.core.windows.net/"},"primaryLocation":"westus","provisioningState":"Succeeded","statusOfPrimary":"available"},"sku":{"name":"Standard_LRS","tier":"Standard"},"tags":{},"type":"Microsoft.Storage/storageAccounts"},{"id":"/subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/vishrutrg/providers/Microsoft.Storage/storageAccounts/vishrutsa","kind":"Storage","location":"westus","name":"vishrutsa","properties":{"creationTime":"2016-03-16T17:21:57.7793489Z","primaryEndpoints":{"blob":"https://vishrutsa.blob.core.windows.net/","file":"https://vishrutsa.file.core.windows.net/","queue":"https://vishrutsa.queue.core.windows.net/","table":"https://vishrutsa.table.core.windows.net/"},"primaryLocation":"westus","provisioningState":"Succeeded","statusOfPrimary":"available"},"sku":{"name":"Standard_LRS","tier":"Standard"},"tags":{},"type":"Microsoft.Storage/storageAccounts"},{"id":"/subscriptions/<AZURE_SUBSCRIPTION_ID>/resourceGroups/vishrutrg/providers/Microsoft.Storage/storageAccounts/vishrutsa1","kind":"Storage","location":"westus","name":"vishrutsa1","properties":{"creationTime":"2016-04-21T20:49:38.2606433Z","primaryEndpoints":{"blob":"https://vishrutsa1.blob.core.windows.net/","file":"https://vishrutsa1.file.core.windows.net/","queue":"https://vishrutsa1.queue.core.windows.net/","table":"https://vishrutsa1.table.core.windows.net/"},"primaryLocation":"westus","provisioningState":"Succeeded","statusOfPrimary":"available"},"sku":{"name":"Standard_LRS","tier":"Standard"},"tags":{},"type":"Microsoft.Storage/storageAccounts"}]}
```
