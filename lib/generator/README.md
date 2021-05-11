### What does the tool do? What issues does the tool catch?

Example Generator generates swagger examples according to swagger spec file.

#### Command usage:

```bash
oav generate-examples <spec-path>

Params:
  spec-path          the swagger spec file path


Options:
  --version                Show version number                         [boolean]
  -l, --logLevel           Set the logging level for console.
  [choices: "off", "json", "error", "warn", "info", "verbose", "debug", "silly"]
                                                               [default: "info"]
  -f, --logFilepath        Set the log file path. It must be an absolute
                           filepath. By default the logs will stored in a
                           timestamp based log file at
                           "/home/abc/oav_output".
  -p, --pretty             Pretty print
  -o, --operationIds       String of operation ids split by comma.      [string]
  --payload, --payloadDir  the directory path contains payload.         [string]
  -c, --config             the readme config path.                      [string]
  --tag, --tagName         the readme tag name.                         [string]
  -h, --help               Show help                                   [boolean]

```
## payload file
Payload directory should contain sub folders named by `[RP_namespace]/[stable|preview]/[api-version]/[operationId]`, for example, `Microsoft.AppPlatform/stable/2020-07-01/SignalR_Get`. Put payload files named by status code under this correspondent folder of `operationId`.
```bash
.
└── SignalR_Get
    └── 200.json
└── SignalR_CreateOrUpdate
    ├── 201.json
    └── 202.json
```

Payload file should be a valid json file and contains liveRequest && liveResponse. It can be fetched in live validation result from kusto.

```json

{
    "liveRequest": {
        "headers": {},
        "method": "PUT",
        "url": "",
        "body": {},
        "query": {}
    },
    "liveResponse": {
        "statusCode": "202",
        "headers": {
        },
        "body": {}
    }
}
```
