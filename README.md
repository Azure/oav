# openapi-validation-tools
Tools for validating OpenAPI (Swagger) files.

### Requirements
- node version > 4.x


### How to run the tool 
- After cloning the repo execute following steps from your terminal/cmd prompt

```
npm install
node validate.js
```

Command usage:
```
D:\sdk\openapi-validation-tools>node validate.js

Usage: node validate.js <command> <spec-path> [--json]


Commands:

  - spec <raw-github-url OR local file-path to the swagger spec> [--json]    | Description: Performs semantic validation of the spec.

  - example <raw-github-url OR local file-path to the swagger spec> [--json] | Description: Performs validation of x-ms-examples and examples present in the spec.
```
---
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
