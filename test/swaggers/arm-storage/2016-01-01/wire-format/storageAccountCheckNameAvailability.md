## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/checkNameAvailability?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 78
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 2acafb4a-35b3-4a06-98fd-0177f4c8cf85
host: management.azure.com
Connection: close

{"name":"storage4db9202c66274d529","type":"Microsoft.Storage/storageAccounts"}
```

## Curl

```bash
curl -X POST 'https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/checkNameAvailability?api-version=2016-01-01' \
-H 'authorization: bearer <token>' \ 
-H 'Content-Length: 78' \
-H 'Content-Type: application/json' \
-H 'accept-language: en-US' \
-H 'x-ms-client-request-id: 2acafb4a-35b3-4a06-98fd-0177f4c8cf85' \
-d { \
  "name": "storage4db9202c66274d529", \
  "type": "Microsoft.Storage/storageAccounts" \
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
x-ms-request-id: 4781bf57-9efb-403c-b452-8636e4cda898
x-ms-correlation-request-id: 4781bf57-9efb-403c-b452-8636e4cda898
x-ms-routing-request-id: WESTUS2:20170429T031120331Z:4781bf57-9efb-403c-b452-8636e4cda898
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 22
content-type: application/json
Date: Sat, 29 Apr 2017 03:11:20 GMT
Connection: close

{"nameAvailable":true}
```
