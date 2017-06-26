## Request

```http
DELETE https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 7cc95247-f49f-422e-adc9-d910c0038490
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X DELETE 'https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 7cc95247-f49f-422e-adc9-d910c0038490' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: aa9c3391-d065-4db9-b32d-b06143096172
x-ms-correlation-request-id: aa9c3391-d065-4db9-b32d-b06143096172
x-ms-routing-request-id: WESTUS2:20170626T175630022Z:aa9c3391-d065-4db9-b32d-b06143096172
Strict-Transport-Security: max-age=31536000; includeSubDomains
content-type: application/json
Date: Mon, 26 Jun 2017 17:56:30 GMT
Connection: close


```
