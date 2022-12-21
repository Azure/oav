# Cognitive Services Language SDK

This is the AutoRest configuration file the Cognitive Services Language SDK.

> see https://aka.ms/autorest

## Releases

The current preview release of Language is 2022-10-01-preview.

The current stable release of Question Answering is 2021-10-01.

The current stable release of Conversational Language Understanding and Language is 2022-05-01.

```yaml
tag: release_2022_10_01_preview
add-credentials: true
clear-output-folder: true
openapi-type: data-plane
directive:
  - suppress: LongRunningResponseStatusCode
    reason: The validation tools do not properly recognize 202 as a supported response code.
  - suppress: R3016
    where: $.definitions.CurrencyResolution.properties.ISO4217
    reason: ISO should be upper case.
```

### Release 2022-10-01-preview

These settings apply only when `--tag=release_2022_10_01_preview` is specified on the command line.

``` yaml $(tag) == 'release_2022_10_01_preview'
input-file:
  - preview/2022-10-01-preview/analyzetext.json
  - preview/2022-10-01-preview/analyzetext-authoring.json
  - preview/2022-10-01-preview/analyzeconversations.json
  - preview/2022-10-01-preview/analyzeconversations-authoring.json
  - preview/2022-10-01-preview/questionanswering.json
  - preview/2022-10-01-preview/questionanswering-authoring.json
title:
  Microsoft Cognitive Language Service
modelerfour:
  lenient-model-deduplication: true

```
