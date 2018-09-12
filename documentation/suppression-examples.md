# Suppression Examples

## Current Spec Errors

- `INVALID_TYPE`

## Additional Validations

### Semantic Validation: Ignored Properties in Schema (Error)

For example https://github.com/Azure/azure-rest-api-specs/blob/master/specification/adhybridhealthservice/resource-manager/Microsoft.ADHybridHealthService/stable/2014-01-01/ADHybridHealthService.json#L5910

```
{
    "type": "object",
    "items": {
        "$ref": "#/definitions/Items"
    }
}
```

### Nested Definitions (Warning)

```
{
    "type": "object",
    "properties": {
        "a": {
            "type": "object",
            "properties": {
                "b": {
                    "type": "string"
                }
            }
        }
    }
}
```
