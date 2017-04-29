## Request

```http
DELETE https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 8c3c0d2d-fbc1-4597-8054-40599de1480a
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X DELETE 'https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 8c3c0d2d-fbc1-4597-8054-40599de1480a' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 6c22886a-9209-4d79-83ed-2213d5abf6a6
x-ms-correlation-request-id: 6c22886a-9209-4d79-83ed-2213d5abf6a6
x-ms-routing-request-id: WESTUS2:20170429T031120342Z:6c22886a-9209-4d79-83ed-2213d5abf6a6
Strict-Transport-Security: max-age=31536000; includeSubDomains
content-type: application/json
Date: Sat, 29 Apr 2017 03:11:20 GMT
Connection: close


```
