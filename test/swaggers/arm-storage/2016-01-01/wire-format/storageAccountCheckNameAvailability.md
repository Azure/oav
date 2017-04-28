## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/checkNameAvailability?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 78
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 69ad572c-2cc2-4766-9b66-edd7a88a9191
host: management.azure.com
Connection: close

{"name":"storage4db9202c66274d529","type":"Microsoft.Storage/storageAccounts"}
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: d4718e14-93bb-493f-a37d-9dfa0fbcd224
x-ms-correlation-request-id: d4718e14-93bb-493f-a37d-9dfa0fbcd224
x-ms-routing-request-id: WESTUS2:20170428T104557791Z:d4718e14-93bb-493f-a37d-9dfa0fbcd224
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 22
content-type: application/json
Date: Fri, 28 Apr 2017 10:45:57 GMT
Connection: close

{"nameAvailable":true}
```
