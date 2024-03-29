# EventGrid

> see https://aka.ms/autorest

This is the AutoRest configuration file for Azure EventGrid.

---

## Getting Started

To build the SDK for Azure EventGrid, simply [Install AutoRest](https://aka.ms/autorest/install) and in this folder, run:

> `autorest`

To see additional help and options, run:

> `autorest --help`

---

## Configuration

### Basic Information

These are the global settings for the Azure EventGrid API.

``` yaml
openapi-type: arm
tag: package-2020-06
```

### Tag: package-2020-06

These settings apply only when `--tag=package-2020-06` is specified on the command line.

``` yaml $(tag) == 'package-2020-06'
input-file:
- Microsoft.EventGrid/stable/2020-06-01/EventGrid.json
```
