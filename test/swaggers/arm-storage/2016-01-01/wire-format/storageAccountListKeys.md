## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/listKeys?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 80892982-38f0-48de-8402-ddc443142f99
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X POST 'https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/listKeys?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 80892982-38f0-48de-8402-ddc443142f99' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 9a191c73-3bd1-4cb8-a821-1fac8fb3fe93
x-ms-correlation-request-id: 9a191c73-3bd1-4cb8-a821-1fac8fb3fe93
x-ms-routing-request-id: WESTUS2:20170429T031120358Z:9a191c73-3bd1-4cb8-a821-1fac8fb3fe93
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 130
content-type: application/json
Date: Sat, 29 Apr 2017 03:11:20 GMT
Connection: close

{"keys":[{"keyName":"key1","permissions":"Full","value":"key1value"},{"keyName":"key2","permissions":"Full","value":"key2value"}]}
```
