### Tag: package-1-0

These settings apply only when `--tag=package-1-0` is specified on the command line.

``` yaml $(tag) == 'package-1-0'
prepare:
  api-scenario: ../resource-manager/Microsoft.AppConfiguration/stable/2022-05-01/scenarios/quickstart.yaml

test-resources:
  - Microsoft.AppConfiguration/stable/1.0/scenarios/crud.yaml
```
