## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/regenerateKey?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 18
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 5c4369e9-dbbe-40f4-b3e0-062fb4e94818
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
-H 'x-ms-client-request-id: 5c4369e9-dbbe-40f4-b3e0-062fb4e94818' \
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
x-ms-request-id: 5308704a-5f66-4537-8d19-aca84e7655ef
x-ms-correlation-request-id: 5308704a-5f66-4537-8d19-aca84e7655ef
x-ms-routing-request-id: WESTUS2:20170628T164714980Z:5308704a-5f66-4537-8d19-aca84e7655ef
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 288
content-type: application/json
Date: Wed, 28 Jun 2017 16:47:14 GMT
Connection: close

{"keys":[{"keyName":"key1","permissions":"Full","value":"v3n81UPv5EivAXLav/YCVo+t8sLMWecXmUVN9siJn4bFR38Fx1hElZOnHXV42drrCThqOmgTJgFKnR0zUGe4dA=="},{"keyName":"key2","permissions":"Full","value":"IRBjhmQr+tnUQtlFAiyi7HK93YfMovmdPUsKEI8P458cfP9AG+9CgxgJOm4EJWOEb87Ml3dr9+p40njjRApduA=="}]}
```
