## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/regenerateKey?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 18
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 2f4b9ac9-4f2f-482d-bbf6-86bba6564f81
host: management.azure.com
Connection: close

{"keyName":"key1"}
```

## Curl

```bash
curl -X POST 'https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/regenerateKey?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \ 
-H 'Content-Length: 18' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 2f4b9ac9-4f2f-482d-bbf6-86bba6564f81' \
-d { \
  "keyName": "key1" \
}
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: f1cd60f4-db0f-4211-a6d6-621d5e1e854f
x-ms-correlation-request-id: f1cd60f4-db0f-4211-a6d6-621d5e1e854f
x-ms-routing-request-id: WESTUS2:20170429T031120364Z:f1cd60f4-db0f-4211-a6d6-621d5e1e854f
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 288
content-type: application/json
Date: Sat, 29 Apr 2017 03:11:20 GMT
Connection: close

{"keys":[{"keyName":"key1","permissions":"Full","value":"v3n81UPv5EivAXLav/YCVo+t8sLMWecXmUVN9siJn4bFR38Fx1hElZOnHXV42drrCThqOmgTJgFKnR0zUGe4dA=="},{"keyName":"key2","permissions":"Full","value":"IRBjhmQr+tnUQtlFAiyi7HK93YfMovmdPUsKEI8P458cfP9AG+9CgxgJOm4EJWOEb87Ml3dr9+p40njjRApduA=="}]}
```
