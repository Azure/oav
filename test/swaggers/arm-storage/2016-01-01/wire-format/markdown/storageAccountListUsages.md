## Request

```http
GET https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/usages?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 45e2d7a1-6e27-47f4-ac36-35ffe9ec6ab9
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X GET 'https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/usages?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 45e2d7a1-6e27-47f4-ac36-35ffe9ec6ab9' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 5ff1b683-b956-43c1-89e9-c150898ce475
x-ms-correlation-request-id: 5ff1b683-b956-43c1-89e9-c150898ce475
x-ms-routing-request-id: WESTUS2:20170626T175630025Z:5ff1b683-b956-43c1-89e9-c150898ce475
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 128
content-type: application/json
Date: Mon, 26 Jun 2017 17:56:30 GMT
Connection: close

{"value":[{"unit":"Count","currentValue":3,"limit":100,"name":{"value":"StorageAccounts","localizedValue":"Storage Accounts"}}]}
```
