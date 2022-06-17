# Storage

> see https://aka.ms/autorest

This is the AutoRest configuration file for Storage.



---
## Getting Started
To build the SDK for Storage, simply [Install AutoRest](https://aka.ms/autorest/install) and in this folder, run:

> `autorest`

To see additional help and options, run:

> `autorest --help`
---

## Configuration



### Basic Information
These are the global settings for the Storage API.

``` yaml
openapi-type: arm
tag: package-2021-08
```
### Tag: package-2021-08

These settings apply only when `--tag=package-2021-08` is specified on the command line.

``` yaml $(tag) == 'package-2021-08'
input-file:
- Microsoft.Storage/stable/2021-08-01/storage.json
- Microsoft.Storage/stable/2021-08-01/blob.json
- Microsoft.Storage/stable/2021-08-01/file.json
- Microsoft.Storage/stable/2021-08-01/queue.json
- Microsoft.Storage/stable/2021-08-01/table.json

```
