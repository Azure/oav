## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/regenerateKey?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 18
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: cdc8e6aa-628b-4786-8815-7f5d3bcb03c0
host: management.azure.com
Connection: close

{"keyName":"key1"}
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 01dcdf2c-8832-45bc-97d9-38c0ac28fe5a
x-ms-correlation-request-id: 01dcdf2c-8832-45bc-97d9-38c0ac28fe5a
x-ms-routing-request-id: WESTUS2:20170428T104557823Z:01dcdf2c-8832-45bc-97d9-38c0ac28fe5a
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 288
content-type: application/json
Date: Fri, 28 Apr 2017 10:45:57 GMT
Connection: close

{"keys":[{"keyName":"key1","permissions":"Full","value":"v3n81UPv5EivAXLav/YCVo+t8sLMWecXmUVN9siJn4bFR38Fx1hElZOnHXV42drrCThqOmgTJgFKnR0zUGe4dA=="},{"keyName":"key2","permissions":"Full","value":"IRBjhmQr+tnUQtlFAiyi7HK93YfMovmdPUsKEI8P458cfP9AG+9CgxgJOm4EJWOEb87Ml3dr9+p40njjRApduA=="}]}
```
