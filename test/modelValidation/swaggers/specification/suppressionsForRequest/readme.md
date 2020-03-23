## Suppression

```yaml
directive:
  - suppress: INVALID_REQUEST_PARAMETER
    from: "test.json"
    text-matches: "api-version"
  - suppress: INVALID_REQUEST_PARAMETER
    from: "test.json"
    text-matches: "accountName"
```