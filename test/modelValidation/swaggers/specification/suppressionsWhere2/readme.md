## Suppression

```yaml
directive:
  - suppress: INVALID_TYPE
    from: "test.json"
    where: "$.definitions.CheckNameAvailabilityResult.properties.nameAvailable"
  - suppress: OBJECT_ADDITIONAL_PROPERTIES
    from: "test.json"
    where: "$.definitions.CheckNameAvailabilityResult"
    text-matches: "unknownProperty"
```