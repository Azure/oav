import * as assert from "assert";
import { DefaultConfig } from "../lib/util/constants";
import { RequestResponsePair } from "../lib/liveValidation/liveValidator";
import { LiveValidator } from "../lib/liveValidation/liveValidator";

jest.setTimeout(999999);

describe("Live Validator", () => {
  describe("Initialization", () => {
    it("OperationLoader should be completely initialized", async () => {
      console.log("OperationLoader should be completely initialized");
      const swaggerPattern = "specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/runCommands.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/runCommands.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      assert.equal(validator.withRefSibingsOperationSearcher.cache.size, 1);
    });

    it("OperationLoader should be completely initialized", async () => {
      console.log("OperationLoader should be completely initialized");
      const swaggerPattern = "specification/**/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "**/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      assert.equal(validator.withRefSibingsOperationSearcher.cache.size, 19);
    });

    it("readonly properties should not cause error", async () => {
      console.log("readonly properties should not cause error");
      const swaggerPattern = "specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_valid.json`);
      const rest = await validator.validateRoundTrip(payload);
      assert.equal(rest.errors, 0);
      assert.equal(rest.isSuccessful, true);
      expect(rest).toMatchSnapshot();
      //end of roundtrip validation
    });

    it("Round trip validation fail", async () => {
      console.log("Round trip validation fail");
      const swaggerPattern = "specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_invalid.json`);
      const rest = await validator.validateRoundTrip(payload);
      expect(rest).toMatchSnapshot();
      assert.equal(rest.errors.length, 7);
      assert.equal(rest.isSuccessful, false);
      for (const re of rest.errors) {
        if (re.pathsInPayload[0].includes("location")) {
          assert.equal(re.code, "ROUNDTRIP_INCONSISTENT_PROPERTY");
        } else if (re.pathsInPayload[0].includes("createOption")) {
          assert.equal(re.code, "ROUNDTRIP_MISSING_PROPERTY");
        } else if (re.pathsInPayload[0].includes("caching")) {
          assert.equal(re.code, "ROUNDTRIP_ADDITIONAL_PROPERTY");
        } else if (re.pathsInPayload[0].includes("offer")) {
          assert.equal(re.code, "ROUNDTRIP_MISSING_PROPERTY");
        } else if (re.pathsInPayload[0].includes("computerName")) {
          assert.equal(re.code, "ROUNDTRIP_MISSING_PROPERTY");
        }
      }
      //end of roundtrip validation
    });

    it("Round trip validation of circular spec", async () => {
      console.log("Round trip validation fail");
      const swaggerPattern = "specification/containerservice/resource-manager/Microsoft.ContainerService/stable/2019-08-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "containerservice/resource-manager/Microsoft.ContainerService/stable/2019-08-01/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundtrip_failure_circularspec.json`);
      const rest = await validator.validateRoundTrip(payload);
      assert.equal(rest.errors.length, 3);
      assert.equal(rest.isSuccessful, false);
      for (const re of rest.errors) {
        if (re.pathsInPayload[0].includes("location")) {
          assert.equal(re.code, "ROUNDTRIP_ADDITIONAL_PROPERTY");
        } else if (re.pathsInPayload[0].includes("properties")) {
          assert.equal(re.code, "ROUNDTRIP_ADDITIONAL_PROPERTY");
        } else if (re.pathsInPayload[0].includes("identity")) {
          assert.equal(re.code, "ROUNDTRIP_ADDITIONAL_PROPERTY");
        }
      }
      //end of roundtrip validation
    });

    it("Round trip validation of circular spec cognitiveService", async () => {
      console.log("Round trip validation fail");
      const swaggerPattern = "specification/cognitiveservices/data-plane/Language/preview/2022-10-01-preview/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "cognitiveservices/data-plane/Language/preview/2022-10-01-preview/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_circularReference_analyzetext.json`);
      const rest = await validator.validateRoundTrip(payload);
      assert.equal(rest.errors.length, 5);
      assert.equal(rest.isSuccessful, false);
      for (const re of rest.errors) {
        if (re.pathsInPayload[0].includes("text")) {
          assert.equal(re.code, "ROUNDTRIP_ADDITIONAL_PROPERTY");
        } else if (re.pathsInPayload[0].includes("defaultLanguage")) {
          assert.equal(re.code, "ROUNDTRIP_INCONSISTENT_PROPERTY");
        } else if (re.pathsInPayload[0].includes("version")) {
          assert.equal(re.code, "ROUNDTRIP_MISSING_PROPERTY");
        }
      }
      //end of roundtrip validation
    });

  });

  describe("Initialize cache and validate", () => {
    const livePaths = glob
      .sync("test/liveValidation/swaggers/**/live/*.json")
      .map((it: any) => path.resolve(process.cwd(), it));
    livePaths.forEach((livePath: any) => {
      it(`should validate request and response for "${livePath}"`, async () => {
        const options = {
          directory: "./test/liveValidation/swaggers/specification/storage",
          swaggerPathsPattern: ["**/*.json"],
          enableRoundTripValidator: true
        };
        const validator = new LiveValidator(options);
        await validator.initialize();
        const reqRes = require(livePath);
        const validationResult = await validator.validateLiveRequestResponse(reqRes);
        assert.notStrictEqual(validationResult, undefined);
        /* tslint:disable-next-line */
        // console.dir(validationResult, { depth: null, colors: true })
      });
    });
    it("should initialize for defaultErrorOnly and fail on unknown status code", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification/defaultIsErrorOnly",
        swaggerPathsPattern: ["test.json"],
        enableRoundTripValidator: true
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      const result = await validator.validateLiveRequestResponse({
        liveRequest: {
          url: "https://xxx.com/providers/someprovider?api-version=2018-01-01",
          method: "get",
          headers: {
            "content-type": "application/json",
          },
          query: {
            "api-version": "2016-01-01",
          },
        },
        liveResponse: {
          statusCode: "300",
          headers: {
            "content-Type": "application/json",
          },
        },
      });
      const errors = result.responseValidationResult.errors;
      if (errors === undefined) {
        throw new Error("errors === undefined");
      }
      assert.strictEqual((errors[0] as any).code, "INVALID_RESPONSE_CODE");
    });

    // should be case insensitive for paramter name and the value of api version, resource provider
    it("should be case-insensitive for parameter name, resource provider and API version", async () => {
      const options = {
        directory:
          "./test/liveValidation/swaggers/specification/storage/resource-manager/Microsoft.Storage/2015-05-01-preview",
        swaggerPathsPattern: ["*.json"],
        enableRoundTripValidator: true
      };
      // Upper and lowercased provider and api-version strings for testing purpose
      const adjustedUrl =
        "/subscriptions/rs/resourceGroups/rsg/providers/MICROsoft.stoRAGE/storageAccounts/test?api-version=2015-05-01-PREVIEW";
      const validator = new LiveValidator(options);
      await validator.initialize();
      const result = await validator.validateLiveRequestResponse({
        liveRequest: {
          url: adjustedUrl.toLocaleUpperCase(),
          method: "get",
          headers: {
            "content-type": "application/json",
          },
          query: {
            "api-version": "2015-05-01-PREVIEW",
          },
        },
        liveResponse: {
          statusCode: "200",
          headers: {
            "content-type": "application/json",
          },
          body: {
            location: "testLocation",
            properties: {
              creationTime: "2017-05-24T13:28:53.4540398Z",
              primaryEndpoints: {
                blob: "https://random.blob.core.windows.net/",
                queue: "https://random.queue.core.windows.net/",
                table: "https://random.table.core.windows.net/",
              },
              accountType: "Standard_LRS",
              primaryLocation: "eastus2euap",
              provisioningState: "Succeeded",
              secondaryLocation: "centraluseuap",
              statusOfPrimary: "Available",
              statusOfSecondary: "Available",
            },
            type: "Microsoft.Storage/storageAccounts",
          },
        },
      });
      // Should be able to find Microsoft.Storage with 2015-05-01-preview api version successfully
      const errors = result.responseValidationResult.errors;
      assert.deepStrictEqual(errors, []);
      assert.equal(result.responseValidationResult.isSuccessful, true);
      assert.equal(typeof result.responseValidationResult.runtimeException, "undefined");
    });

    it("should not match to Microsoft.Resources for the unknown resourceprovider", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/",
        swaggerPathsPattern: [
          "specification/resources/resource-manager/Microsoft.Resources/2015-11-01/*.json",
        ],
        enableRoundTripValidator: true
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/fooResourceProvider_input.json`);
      const result = await validator.validateLiveRequestResponse(payload);
      const runtimeException = result.requestValidationResult.runtimeException;
      if (runtimeException === undefined) {
        throw new Error("runtimeException === undefined");
      }
      assert.strictEqual(runtimeException.code, "OPERATION_NOT_FOUND_IN_CACHE_WITH_PROVIDER");
      assert.strictEqual(payload.liveResponse.statusCode, "200");
    });

    it(`should pass response header tests`, async () => {
      const options = {
        directory: `./test/liveValidation/swaggers/`,
        swaggerPathsPattern: [
          "specification/apimanagement/resource-manager/Microsoft.ApiManagement/**/*.json",
        ],
        enableRoundTripValidator: true
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      const payload = require(`${__dirname}/liveValidation/payloads/missingResponseHeader_shouldSucceed.json`);
      const result = await validator.validateLiveRequestResponse(payload);
      assert.strictEqual(result.responseValidationResult.isSuccessful, true);
    });

    it(`should not report error in response when both x-ms-secret and requried are declared`, async () => {
      const options = {
        directory: `${__dirname}/liveValidation/swaggers/`,
        isPathCaseSensitive: false,
        useRelativeSourceLocationUrl: true,
        swaggerPathsPattern: ["specification/contoso/resource-manager/Microsoft.Contoso/**/*.json"],
        git: {
          shouldClone: false,
        },
        enableRoundTripValidator: true
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/xmsSecretAndRequired.json`);
      const result = await liveValidator.validateLiveRequestResponse(payload);
      assert.equal(result.responseValidationResult.isSuccessful, true);
    });

    describe("x-ms-secret validation", () => {
      // [√]httpMethod: POST, [√]x-ms-secret: "true", [X]x-ms-mutability: "create" and "update"
      it(`should not report error in response for POST when the value of x-ms-secret is true`, async () => {
        const options = {
          directory: `${__dirname}/liveValidation/swaggers/`,
          isPathCaseSensitive: false,
          useRelativeSourceLocationUrl: true,
          swaggerPathsPattern: [
            "specification/signalr/resource-manager/Microsoft.SignalRService/2021-01-01/*.json",
          ],
          git: {
            shouldClone: false,
          },
          enableRoundTripValidator: true
        };
        const liveValidator = new LiveValidator(options);
        await liveValidator.initialize();
        const payload = require(`${__dirname}/liveValidation/payloads/xmsSecretAndPOST/xmsSecretAndPOST_2021-01-01.json`);
        const result = await liveValidator.validateLiveRequestResponse(payload);
        assert.equal(result.responseValidationResult.isSuccessful, true);
      });

      // [√]httpMethod: POST, [√]x-ms-secret: "true", [√]x-ms-mutability: "create" and "update"
      it(`should not report error in response for POST,
      when x-ms-secret is "true" and x-ms-mutability is "create" and "update"`, async () => {
        const options = {
          directory: `${__dirname}/liveValidation/swaggers/`,
          isPathCaseSensitive: false,
          useRelativeSourceLocationUrl: true,
          swaggerPathsPattern: [
            "specification/signalr/resource-manager/Microsoft.SignalRService/2021-02-01/*.json",
          ],
          git: {
            shouldClone: false,
          },
          enableRoundTripValidator: true
        };
        const liveValidator = new LiveValidator(options);
        await liveValidator.initialize();
        const payload = require(`${__dirname}/liveValidation/payloads/xmsSecretAndPOST/xmsSecretAndPOST_2021-02-01.json`);
        const result = await liveValidator.validateLiveRequestResponse(payload);
        assert.equal(result.responseValidationResult.isSuccessful, true);
      });

      // [√]httpMethod: POST, [X]x-ms-secret: "true", [√]x-ms-mutability: "create" and "update"
      it(`should report error in response for POST when x-ms-mutability is "create" and "update"`, async () => {
        const options = {
          directory: `${__dirname}/liveValidation/swaggers/`,
          isPathCaseSensitive: false,
          useRelativeSourceLocationUrl: true,
          swaggerPathsPattern: [
            "specification/signalr/resource-manager/Microsoft.SignalRService/2021-03-01/*.json",
          ],
          git: {
            shouldClone: false,
          },
          enableRoundTripValidator: true
        };
        const liveValidator = new LiveValidator(options);
        await liveValidator.initialize();
        const payload = require(`${__dirname}/liveValidation/payloads/xmsSecretAndPOST/xmsSecretAndPOST_2021-03-01.json`);
        const result = await liveValidator.validateLiveRequestResponse(payload);
        assert.equal(result.responseValidationResult.isSuccessful, false);
        const errors = result.responseValidationResult.errors;
        for (const error of errors) {
          assert.equal(
            (error.schemaPath.indexOf("x-ms-secret") !== -1 && error.code === "SECRET_PROPERTY") ||
              (error.schemaPath.indexOf("x-ms-mutability") !== -1 &&
                error.code === "WRITEONLY_PROPERTY_NOT_ALLOWED_IN_RESPONSE"),
            true
          );
        }
      });

      // [X]httpMethod: POST
      it(`should report error in response for httpMethod which is not POST,
      when x-ms-secret is "true" or x-ms-mutability is "create" and "update"`, async () => {
        const swaggers = [
          // [√]x-ms-secret: "true", [X]x-ms-mutability: "create" and "update"
          "2021-01-01-preview/*.json",
          // [√]x-ms-secret: "true", [√]x-ms-mutability: "create" and "update"
          "2021-02-01-preview/*.json",
          // [X]x-ms-secret: "true", [√]x-ms-mutability: "create" and "update"
          "2021-03-01-preview/*.json",
        ];
        for (const swagger of swaggers) {
          const options = {
            directory: `${__dirname}/liveValidation/swaggers/specification/signalr/resource-manager/Microsoft.SignalRService/`,
            isPathCaseSensitive: false,
            useRelativeSourceLocationUrl: true,
            swaggerPathsPattern: [swagger],
            git: {
              shouldClone: false,
            },
            enableRoundTripValidator: true
          };
          const liveValidator = new LiveValidator(options);
          await liveValidator.initialize();
          const payloadVersion = swagger.slice(0, -7);
          const payload = require(`${__dirname}/liveValidation/payloads/xmsSecretAndPOST/xmsSecretButGet_${payloadVersion}.json`);
          const result = await liveValidator.validateLiveRequestResponse(payload);
          assert.equal(result.responseValidationResult.isSuccessful, false);
          const errors = result.responseValidationResult.errors;
          for (const error of errors) {
            assert.equal(
              (error.schemaPath.indexOf("x-ms-secret") !== -1 &&
                error.code === "SECRET_PROPERTY") ||
                (error.schemaPath.indexOf("x-ms-mutability") !== -1 &&
                  error.code === "WRITEONLY_PROPERTY_NOT_ALLOWED_IN_RESPONSE"),
              true
            );
          }
        }
      });
    });

    it(`should not report error in response when response data divided by its multipleOf value is an integer`, async () => {
      const options = {
        directory: `${__dirname}/liveValidation/swaggers/`,
        isPathCaseSensitive: false,
        useRelativeSourceLocationUrl: true,
        swaggerPathsPattern: [
          "specification/netapp/resource-manager/Microsoft.NetApp/2020-07-01/*.json",
        ],
        git: {
          shouldClone: false,
        },
        enableRoundTripValidator: true
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/multipleOfError.json`);
      const result = await liveValidator.validateLiveRequestResponse(payload);
      assert.equal(result.responseValidationResult.isSuccessful, true);
    });

    it(`should report error in response for GET/PUT resource calls when id is not returned`, async () => {
      const options = {
        directory: `${__dirname}/liveValidation/swaggers/`,
        isPathCaseSensitive: false,
        useRelativeSourceLocationUrl: true,
        swaggerPathsPattern: [
          "specification/servicelinker/resource-manager/Microsoft.ServiceLinker/**/*.json",
        ],
        git: {
          shouldClone: false,
        },
        isArmCall: true,
        enableRoundTripValidator: true
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/missingResourceId_input.json`);
      const validationResult = await liveValidator.validateLiveRequestResponse(payload);
      expect(validationResult).toMatchSnapshot();
    });

    it(`should not report error in response for GET/PUT resource calls when id is not returned in sub-level resources`, async () => {
      const options = {
        directory: `${__dirname}/liveValidation/swaggers/`,
        isPathCaseSensitive: false,
        useRelativeSourceLocationUrl: true,
        swaggerPathsPattern: [
          "specification/operationsmanagement/resource-manager/Microsoft.OperationsManagement/**/*.json",
        ],
        git: {
          shouldClone: false,
        },
        isArmCall: true,
        enableRoundTripValidator: true
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/missingResourceId_sublevelResource_input.json`);
      const validationResult = await liveValidator.validateLiveRequestResponse(payload);
      expect(validationResult).toMatchSnapshot();
    });

    it(`should report error in response when response code isn't correct in case of long running operation`, async () => {
      const options = {
        directory: `${__dirname}/liveValidation/swaggers/`,
        isPathCaseSensitive: false,
        useRelativeSourceLocationUrl: true,
        swaggerPathsPattern: [
          "specification/servicelinker/resource-manager/Microsoft.ServiceLinker/**/*.json",
        ],
        git: {
          shouldClone: false,
        },
        isArmCall: true,
        enableRoundTripValidator: true
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/lro_responsecode_error_input.json`);
      const validationResult = await liveValidator.validateLiveRequestResponse(payload);
      expect(validationResult).toMatchSnapshot();
    });

    it(`should report error when LRO header is not returned in response in case of long running operation`, async () => {
      const options = {
        directory: `${__dirname}/liveValidation/swaggers/`,
        isPathCaseSensitive: false,
        useRelativeSourceLocationUrl: true,
        swaggerPathsPattern: [
          "specification/servicelinker/resource-manager/Microsoft.ServiceLinker/**/*.json",
        ],
        git: {
          shouldClone: false,
        },
        isArmCall: true,
        enableRoundTripValidator: true
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/lro_responseheader_error_input.json`);
      const validationResult = await liveValidator.validateLiveRequestResponse(payload);
      expect(validationResult).toMatchSnapshot();
    });

    it(`should not report error when LRO header is not returned in response in case of returning 201 code`, async () => {
      const options = {
        directory: `${__dirname}/liveValidation/swaggers/`,
        isPathCaseSensitive: false,
        useRelativeSourceLocationUrl: true,
        swaggerPathsPattern: [
          "specification/servicelinker/resource-manager/Microsoft.ServiceLinker/**/*.json",
        ],
        git: {
          shouldClone: false,
        },
        isArmCall: true,
        enableRoundTripValidator: true
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/lro_responseheader_ignore_input.json`);
      const validationResult = await liveValidator.validateLiveRequestResponse(payload);
      expect(validationResult).toMatchSnapshot();
    });

    it(`should return no errors for valid input with optional parameter body null`, async () => {
      const options = {
        directory: `${__dirname}/liveValidation/swaggers/`,
        isPathCaseSensitive: false,
        useRelativeSourceLocationUrl: true,
        swaggerPathsPattern: ["specification/contoso/resource-manager/Microsoft.Contoso/**/*.json"],
        git: {
          shouldClone: false,
        },
        enableRoundTripValidator: true
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/valid_inputOptionalParameterBodyNull.json`);
      const validationResult = await liveValidator.validateLiveRequestResponse(payload);
      expect(validationResult).toMatchSnapshot();
    });

    it(`should return no errors for valid input with optional parameter body empty`, async () => {
      const options = {
        directory: `${__dirname}/liveValidation/swaggers/`,
        isPathCaseSensitive: false,
        useRelativeSourceLocationUrl: true,
        swaggerPathsPattern: ["specification/contoso/resource-manager/Microsoft.Contoso/**/*.json"],
        git: {
          shouldClone: false,
        },
        enableRoundTripValidator: true
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/valid_inputOptionalParameterBodyEmpty.json`);
      const validationResult = await liveValidator.validateLiveRequestResponse(payload);
      expect(validationResult).toMatchSnapshot();
    });

    it("should initialize for defaultErrorOnly and pass", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification/defaultIsErrorOnly",
        swaggerPathsPattern: ["test.json"],
        enableRoundTripValidator: true
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      const result = await validator.validateLiveRequestResponse({
        liveRequest: {
          url: "https://xxx.com/providers/someprovider?api-version=2018-01-01",
          method: "get",
          headers: {
            "content-type": "application/json",
          },
          query: {
            "api-version": "2016-01-01",
          },
        },
        liveResponse: {
          statusCode: "404",
          headers: {
            "content-Type": "application/json",
          },
        },
      });
      const errors = result.responseValidationResult.errors;
      assert.deepStrictEqual(errors, []);
    });

    it(`should not report error when payload has property with date-time parameter and its value is valid except missing "Z" in the end`, async () => {
      const options = {
        directory: `${__dirname}/liveValidation/swaggers/`,
        isPathCaseSensitive: false,
        useRelativeSourceLocationUrl: true,
        swaggerPathsPattern: [
          "specification/date-time/resource-manager/Microsoft.DateTime/test.json",
        ],
        git: {
          shouldClone: false,
        },
        enableRoundTripValidator: true
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      const payload = require(`${__dirname}/liveValidation/payloads/dateTime.json`);
      const result = await liveValidator.validateLiveRequestResponse(payload);
      assert.equal(result.responseValidationResult.isSuccessful, true);
    });
  });

  
});
