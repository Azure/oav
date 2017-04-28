## Request

```http
GET https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/usages?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: c70f0522-0c82-4590-8935-595fdbb7e9b0
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
x-ms-request-id: 3409bb52-2c66-4ba9-987e-33af01e3581d
x-ms-correlation-request-id: 3409bb52-2c66-4ba9-987e-33af01e3581d
x-ms-routing-request-id: WESTUS2:20170428T104557827Z:3409bb52-2c66-4ba9-987e-33af01e3581d
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 128
content-type: application/json
Date: Fri, 28 Apr 2017 10:45:57 GMT
Connection: close

{"value":[{"unit":"Count","currentValue":3,"limit":100,"name":{"value":"StorageAccounts","localizedValue":"Storage Accounts"}}]}
```
