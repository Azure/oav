## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/listKeys?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 4f32212c-d1de-4da7-962c-995c989f52c3
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X POST 'https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/listKeys?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 4f32212c-d1de-4da7-962c-995c989f52c3' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: b8a47a4b-1a92-4d65-9842-c9ed60876b8d
x-ms-correlation-request-id: b8a47a4b-1a92-4d65-9842-c9ed60876b8d
x-ms-routing-request-id: WESTUS2:20170628T164714978Z:b8a47a4b-1a92-4d65-9842-c9ed60876b8d
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 130
content-type: application/json
Date: Wed, 28 Jun 2017 16:47:14 GMT
Connection: close

{"keys":[{"keyName":"key1","permissions":"Full","value":"key1value"},{"keyName":"key2","permissions":"Full","value":"key2value"}]}
```
