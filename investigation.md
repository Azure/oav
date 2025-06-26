# Investigation notes

I added some output to a different oav repo with custom logging + pinning path-to-regexp@6.2.2. Running that to get the output, and using that output in a unit test here.

specification/cosmos-db/data-plane/Microsoft.Tables/preview/2019-02-02/table.json
specs-pr#23267/specification/orbital/data-plane/Microsoft.PlanetaryComputer/preview/2025-04-30-preview/openapi.json
specs-pr#23267/specification/orbital/data-plane/Microsoft.PlanetaryComputer/preview/2025-09-30-preview/openapi.json

to obtain inputs on original oav with 6.2.2.:

```
npm run cli -- validate-spec /home/semick/repo/azure-rest-api-specs/specification/cosmos-db/data-plane/Microsoft.Tables/preview/2019-02-02/table.json
npm run cli -- validate-spec /home/semick/repo/azure-rest-api-specs-pr/specification/orbital/data-plane/Microsoft.PlanetaryComputer/preview/2025-04-30-preview/openapi.json
npm run cli -- validate-spec /home/semick/repo/azure-rest-api-specs-pr/specification/orbital/data-plane/Microsoft.PlanetaryComputer/preview/2025-09-30-preview/openapi.json
```