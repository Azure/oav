# CognitiveServices

> see https://aka.ms/autorest

This is the AutoRest configuration file for CognitiveServices.

# Notice

Microsoft will use data you send to Bing Search Services or the Translator Speech API to improve Microsoft products and services. Where you send personal data to these Cognitive Services, you are responsible for obtaining sufficient consent from the data subjects. The General Privacy and Security Terms in the Online Services Terms do not apply to these Cognitive Services. Please refer to the Microsoft Cognitive Services section in the [Online Services Terms](https://www.microsoft.com/en-us/Licensing/product-licensing/products.aspx) for details. Microsoft offers policy controls that may be used to [disable new Cognitive Services deployments](https://docs.microsoft.com/en-us/azure/cognitive-services/cognitive-services-apis-create-account).

---

## Getting Started

To build the SDK for CognitiveServices, simply [Install AutoRest](https://aka.ms/autorest/install) and in this folder, run:

> `autorest`

To see additional help and options, run:

> `autorest --help`

---

## Configuration

### Basic Information

These are the global settings for the CognitiveServices API.

``` yaml
openapi-type: arm
tag: package-2022-10
```


### Tag: package-2022-10

These settings apply only when `--tag=package-2022-10` is specified on the command line.

```yaml $(tag) == 'package-2022-10'
input-file:
  - Microsoft.CognitiveServices/stable/2022-10-01/cognitiveservices.json
```