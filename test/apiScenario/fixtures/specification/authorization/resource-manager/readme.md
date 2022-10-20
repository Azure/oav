# Authorization

> see https://aka.ms/autorest

This is the AutoRest configuration file for Authorization.

---

## Getting Started

To build the SDK for Authorization, simply [Install AutoRest](https://aka.ms/autorest/install) and in this folder, run:

> `autorest`

To see additional help and options, run:

> `autorest --help`

---

## Configuration

### Basic Information

These are the global settings for the Authorization API.

``` yaml
openapi-type: arm
tag: package-2022-04-01
```

### Tag: package-2022-04-01

These settings apply only when `--tag=package-2022-04-01` is specified on the command line.

``` yaml $(tag) == 'package-2022-04-01'
input-file:
- Microsoft.Authorization/stable/2022-04-01/authorization-DenyAssignmentCalls.json
- Microsoft.Authorization/stable/2022-04-01/authorization-ProviderOperationsCalls.json
- Microsoft.Authorization/stable/2022-04-01/authorization-RoleAssignmentsCalls.json
- Microsoft.Authorization/stable/2022-04-01/authorization-RoleDefinitionsCalls.json
- Microsoft.Authorization/stable/2022-04-01/common-types.json
```
