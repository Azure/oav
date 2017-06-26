## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/listKeys?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: b19a8778-d70b-43c0-a774-b137df7f5ac5
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X POST 'https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/listKeys?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: b19a8778-d70b-43c0-a774-b137df7f5ac5' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 712708f2-9a11-4b0b-afbf-96551fed567e
x-ms-correlation-request-id: 712708f2-9a11-4b0b-afbf-96551fed567e
x-ms-routing-request-id: WESTUS2:20170626T175630024Z:712708f2-9a11-4b0b-afbf-96551fed567e
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 130
content-type: application/json
Date: Mon, 26 Jun 2017 17:56:30 GMT
Connection: close

{"keys":[{"keyName":"key1","permissions":"Full","value":"key1value"},{"keyName":"key2","permissions":"Full","value":"key2value"}]}
```
