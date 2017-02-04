# openapi-validation-tools
Tools for validating OpenAPI (Swagger) files.

### What does the tool do? What issues does the tool catch?

Model validation checks whether definitions for request parameters and responses, match an expected input/output payload of the service.

Examples of issues: 
- required properties not sent in requests or responses; 
- defined types not matching the value provided in the payload; 
- constraints on properties not met; enumeration values that don’t match the value used by the service. 

References: https://github.com/Azure/azure-rest-api-specs/issues/778 , https://github.com/Azure/azure-rest-api-specs/issues/755 , https://github.com/Azure/azure-rest-api-specs/issues/773 

Model validation *requires* example payloads (request/response) of the service, so the data can be matched with the defined models. See [x-ms-examples extension](https://github.com/Azure/azure-rest-api-specs/issues/648) on how to specify the examples/payloads. Swagger “examples” is also supported and data included there is validated as well. To get the most benefit from this tool, make sure to have the simplest and most complex examples possible as part of x-ms-examples.
The tool relies on swagger-tools package to perform model validation.

### How does this tool fit with others?

Swagger specs validation could be split in the following:
   - 1.	Schema validation
   - 2.	Semantic validation 
   - 3.	Model definition validation
   - 4.	Swagger operations execution (against mocked data or live tests)
   - 5.	Human-eye review to complement the above

In the context of “azure-rest-api-specs” repo:
  - #1 is being performed on every PR as part of CI.
  - #2 and #3 are performed by the tool currently in openapi-validation-tools repo and by AutoRest linter. We’re working towards integrating them into CI for “azure-rest-api-specs” repo.
  -	#4 is not available yet, though we’re starting to work on it. 
  -	#5 will be done by the approvers of PRs in “azure-rest-api-specs”, as this won’t be automated. 

### Requirements
- node version > 4.x

You can install the latest stable release of node.js from [here](https://nodejs.org/en/download/). For a machine with a linux flavored OS, please follow the node.js installation instructions over [here](https://nodejs.org/en/download/package-manager/)


### How to run the tool 
- After cloning the repo execute following steps from your terminal/cmd prompt

```
npm install
node validate.js
```

#### Command usage:
```
MacBook-Pro:openapi-validation-tools someUser$ node cli.js -h
Commands:
  live-test <spec-path>         Performs validation of x-ms-examples and
                                examples present in the spec.
  validate-example <spec-path>  Performs validation of x-ms-examples and
                                examples present in the spec.
  validate-spec <spec-path>     Performs semantic validation of the spec.

Options:
  --version       Show version number                                  [boolean]
  -j, --json      Show json output                                     [boolean]
  -l, --logLevel  Set the logging level for console.
       [choices: "error", "warn", "info", "verbose", "debug", "silly"] [default:
                                                                         "warn"]
  -h, --help      Show help                                            [boolean]
```

---
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
