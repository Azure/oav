## Request

```http
GET https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/usages?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 4f855501-2c18-4019-a2f6-6a016b048309
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X GET 'https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/usages?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 4f855501-2c18-4019-a2f6-6a016b048309' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 4970aa6e-f256-451d-8da0-ab3ca6b24803
x-ms-correlation-request-id: 4970aa6e-f256-451d-8da0-ab3ca6b24803
x-ms-routing-request-id: WESTUS2:20170628T164714980Z:4970aa6e-f256-451d-8da0-ab3ca6b24803
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 128
content-type: application/json
Date: Wed, 28 Jun 2017 16:47:14 GMT
Connection: close

{"value":[{"unit":"Count","currentValue":3,"limit":100,"name":{"value":"StorageAccounts","localizedValue":"Storage Accounts"}}]}
```
