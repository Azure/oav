## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/regenerateKey?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 18
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 7754f5d6-7171-43f7-9eaa-8317c74b44fd
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
-H 'x-ms-client-request-id: 7754f5d6-7171-43f7-9eaa-8317c74b44fd' \
-d @- << EOF
{
  "keyName": "key1"
}
EOF
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: b2822714-7fad-420a-bb8d-fccda061d679
x-ms-correlation-request-id: b2822714-7fad-420a-bb8d-fccda061d679
x-ms-routing-request-id: WESTUS2:20170626T175630025Z:b2822714-7fad-420a-bb8d-fccda061d679
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 288
content-type: application/json
Date: Mon, 26 Jun 2017 17:56:30 GMT
Connection: close

{"keys":[{"keyName":"key1","permissions":"Full","value":"v3n81UPv5EivAXLav/YCVo+t8sLMWecXmUVN9siJn4bFR38Fx1hElZOnHXV42drrCThqOmgTJgFKnR0zUGe4dA=="},{"keyName":"key2","permissions":"Full","value":"IRBjhmQr+tnUQtlFAiyi7HK93YfMovmdPUsKEI8P458cfP9AG+9CgxgJOm4EJWOEb87Ml3dr9+p40njjRApduA=="}]}
```
