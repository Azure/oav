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

- Please take a look at the redis-cache swagger spec as an example for providing "x-ms-examples" over [here](https://github.com/Azure/azure-rest-api-specs/blob/master/arm-redis/2016-04-01/swagger/redis.json#L45).
- The examples need to be provided in a separate file in the examples directory under the api-version directory `azure-rest-api-specs/arm-<yourService>/<api-version>/examples/<exampleName>.json`. You can take a look over [here](https://github.com/Azure/azure-rest-api-specs/tree/master/arm-redis/2016-04-01/examples) for the structure of examples.
- We require you to provide us a minimum (just required properties/parameters of the request/response) and a maximum (full blown) example. Feel free to provide more examples as deemed necessary. 
- We have provided schemas for examples to be provided in the examples directory. It can be found over [here](https://github.com/Azure/autorest/blob/master/schema/example-schema.json). This will help you with intellisene and validation.
  - If you are using **vscode** to edit your swaggers in the azure-rest-api-specs repo then everything should work out of the box as the schemas have been added in the `.vscode/settings.json` file over [here](https://github.com/Azure/azure-rest-api-specs/blob/master/.vscode/settings.json).
  - If you are using **Visual Studio** then you can use the urls provided in the settings.json file and put them in the drop down list at the top of a json file when the file is opened in VS.

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
- **node version > 6.x**

You can install the latest stable release of node.js from [here](https://nodejs.org/en/download/). For a machine with a linux flavored OS, please follow the node.js installation instructions over [here](https://nodejs.org/en/download/package-manager/)


### How to run the tool 
- After cloning the repo execute following steps from your terminal/cmd prompt

```
npm install
node cli.js
```

#### Command usage:
```
bash-3.2$ node cli.js
Commands:
  validate-example <spec-path>  Performs validation of x-ms-examples and
                                examples present in the spec.
  validate-spec <spec-path>     Performs semantic validation of the spec.

Options:
  --version          Show version number                               [boolean]
  -l, --logLevel     Set the logging level for console.
  [choices: "off", "json", "error", "warn", "info", "verbose", "debug", "silly"]
                                                               [default: "warn"]
  -f, --logFilepath  Set the log file path. It must be an absolute filepath. By
                     default the logs will stored in a timestamp based log file
                     at "/Users/amarz/oav_output".
  -h, --help         Show help                                         [boolean]

bash-3.2$
```

---
This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.
