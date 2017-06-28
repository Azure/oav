## Request

```http
POST https://management.azure.com/subscriptions/subcriptionID/providers/Microsoft.Storage/checkNameAvailability?api-version=2016-01-01 HTTP/1.1
Authorization: Bearer <token>
Content-Length: 78
Content-Type: application/json
accept-language: en-US
x-ms-client-request-id: 0143da7f-fc47-44f0-b336-a1c466ce178d
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
-H 'x-ms-client-request-id: 0143da7f-fc47-44f0-b336-a1c466ce178d' \
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
x-ms-request-id: c73fdf5e-ebb9-4663-9961-50e3d5445b64
x-ms-correlation-request-id: c73fdf5e-ebb9-4663-9961-50e3d5445b64
x-ms-routing-request-id: WESTUS2:20170628T164714975Z:c73fdf5e-ebb9-4663-9961-50e3d5445b64
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Length: 22
content-type: application/json
Date: Wed, 28 Jun 2017 16:47:14 GMT
Connection: close

{"nameAvailable":true}
```
