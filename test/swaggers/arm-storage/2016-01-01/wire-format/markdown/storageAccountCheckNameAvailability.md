## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/checkNameAvailability?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 78
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: d3142a63-eec1-45d6-b1d5-6e8f7e7983c7
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
-H 'x-ms-client-request-id: d3142a63-eec1-45d6-b1d5-6e8f7e7983c7' \
-d @- << EOF
{
  "name": "storage4db9202c66274d529",
  "type": "Microsoft.Storage/storageAccounts"
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
x-ms-request-id: 9808eed2-5184-4485-b23a-42ca4fa7d090
x-ms-correlation-request-id: 9808eed2-5184-4485-b23a-42ca4fa7d090
x-ms-routing-request-id: WESTUS2:20170626T175630020Z:9808eed2-5184-4485-b23a-42ca4fa7d090
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 22
content-type: application/json
Date: Mon, 26 Jun 2017 17:56:30 GMT
Connection: close

{"nameAvailable":true}
```
