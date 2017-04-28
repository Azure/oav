## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname/listKeys?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 59c66414-4fb3-408b-87a5-b39ce7b33687
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
x-ms-request-id: aeaf051c-0b79-4fda-a7b9-7e51e299232c
x-ms-correlation-request-id: aeaf051c-0b79-4fda-a7b9-7e51e299232c
x-ms-routing-request-id: WESTUS2:20170428T104557807Z:aeaf051c-0b79-4fda-a7b9-7e51e299232c
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 130
content-type: application/json
Date: Fri, 28 Apr 2017 10:45:57 GMT
Connection: close

{"keys":[{"keyName":"key1","permissions":"Full","value":"key1value"},{"keyName":"key2","permissions":"Full","value":"key2value"}]}
```
