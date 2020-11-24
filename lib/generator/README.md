### What does the tool do? What issues does the tool catch?

- Example Generator
Example Generator generate swagger example according to swagger spec file and real payload records.

#### Command usage:

```bash
oav generate-examples <spec-path>

Params:
  spec-path          the swagger spec file path


Options:
  --payload          Set the payload directory which contains all the payload file, the file format is listed below. If no payload file is provided under the directory, then no examples will be generated. If the option '--payload' is not set, the example values will be mocked for all operations.
  -o                 Specify operationId to generate example only for the operation
  -l, --logLevel     Set the logging level for console.
  [choices: "off", "json", "error", "warn", "info", "verbose", "debug", "silly"]
                                                               [default: "warn"]
  -f, --logFilepath  Set the log file path. It must be an absolute filepath. By
                     default the logs will stored in a timestamp based log file
                     at "C:\Users\abc\oav_output".
  -h, --help         Show help                                         [boolean]

```
## payload file
Payload directory should contains folders named by operationId. Put payload files named by status code under the folder.
```bash
.
└── SignalR_Get
    └── 200.json
└── SignalR_CreateOrUpdate
    ├── 201.json
    └── 202.json
```

Payload file should be a valid json file and contains liveRequest && liveResponse. It can be get from Application Insight.

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