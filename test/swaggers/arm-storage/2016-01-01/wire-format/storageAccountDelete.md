## Request

```http
DELETE https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 6c702866-433d-41ae-bbb3-83cd5724c857
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
x-ms-request-id: 8f2022a7-0e91-4620-a9c8-e0b52b38ce25
x-ms-correlation-request-id: 8f2022a7-0e91-4620-a9c8-e0b52b38ce25
x-ms-routing-request-id: WESTUS2:20170428T104557791Z:8f2022a7-0e91-4620-a9c8-e0b52b38ce25
Strict-Transport-Security: max-age=31536000; includeSubDomains
content-type: application/json
Date: Fri, 28 Apr 2017 10:45:57 GMT
Connection: close


```
