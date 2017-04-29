## Request

```http
GET https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/usages?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 6726cdc4-00eb-4774-b1b5-c994ca47a0c7
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X GET 'https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/usages?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 6726cdc4-00eb-4774-b1b5-c994ca47a0c7' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 2be01d32-9fed-4d32-b98e-bd65f1d8b78b
x-ms-correlation-request-id: 2be01d32-9fed-4d32-b98e-bd65f1d8b78b
x-ms-routing-request-id: WESTUS2:20170429T031120372Z:2be01d32-9fed-4d32-b98e-bd65f1d8b78b
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 128
content-type: application/json
Date: Sat, 29 Apr 2017 03:11:20 GMT
Connection: close

{"value":[{"unit":"Count","currentValue":3,"limit":100,"name":{"value":"StorageAccounts","localizedValue":"Storage Accounts"}}]}
```
