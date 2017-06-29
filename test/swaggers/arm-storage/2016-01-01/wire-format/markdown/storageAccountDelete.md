## Request

```http
DELETE https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 0672e7a5-3ecc-4bb4-9284-da6c671f01d1
host: management.azure.com
Connection: close


```

## Curl

```bash
curl -X DELETE 'https://management.azure.com/subscriptions/subcriptionID/resourceGroups/resourcegroupname/providers/Microsoft.Storage/storageAccounts/accountname?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 0672e7a5-3ecc-4bb4-9284-da6c671f01d1' \
```

## Response

#### StatusCode: 200

```http
HTTP 1.1 200
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: 93246b99-b097-457f-a005-971c2bddec18
x-ms-correlation-request-id: 93246b99-b097-457f-a005-971c2bddec18
x-ms-routing-request-id: WESTUS2:20170628T164714977Z:93246b99-b097-457f-a005-971c2bddec18
Strict-Transport-Security: max-age=31536000; includeSubDomains
content-type: application/json
Date: Wed, 28 Jun 2017 16:47:14 GMT
Connection: close


```
