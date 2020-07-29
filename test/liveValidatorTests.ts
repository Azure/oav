// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as assert from "assert";
import * as os from "os";
import * as path from "path";
import * as globby from "globby";
import * as lodash from "lodash";
import { ResponsesObject } from "yasway";
import * as Constants from "../lib/util/constants";
import { LiveValidator } from "../lib/validators/liveValidator";

const numberOfSpecs = 11;
jest.setTimeout(5000);

describe("Live Validator", () => {
  describe("Initialization", () => {
    it("should initialize with defaults", () => {
      const options = {
        swaggerPaths: [],
        excludedSwaggerPathsPattern: Constants.DefaultConfig.ExcludedSwaggerPathsPattern,
        git: {
          url: "https://github.com/Azure/azure-rest-api-specs.git",
          shouldClone: false,
        },
        directory: path.resolve(os.homedir(), "repo"),
        isPathCaseSensitive: false,
      };
      const validator = new LiveValidator();
      assert.deepStrictEqual(validator.cache, {});
      assert.deepStrictEqual(validator.options, options);
    });
    it("should initialize with cloning", async () => {
      const options = {
        swaggerPaths: [],
        excludedSwaggerPathsPattern: Constants.DefaultConfig.ExcludedSwaggerPathsPattern,
        git: {
          url: "https://github.com/Azure/oav.git",
          shouldClone: true,
        },
        directory: path.resolve(os.homedir(), "repo"),
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      assert.deepStrictEqual(validator.cache, {});
      assert.deepStrictEqual(validator.options, options);
    });
    it("should initialize without url", () => {
      const options = {
        swaggerPaths: [],
        git: {
          shouldClone: false,
        },
        directory: path.resolve(os.homedir(), "repo"),
      };
      const validator = new LiveValidator(options);
      assert.deepStrictEqual(validator.cache, {});
      assert.deepStrictEqual(
        validator.options.git.url,
        "https://github.com/Azure/azure-rest-api-specs.git"
      );
    });
    it("should initialize with user provided swaggerPaths", () => {
      const swaggerPaths = ["swaggerPath1", "swaggerPath2"];
      const options = {
        isPathCaseSensitive: false,
        excludedSwaggerPathsPattern: Constants.DefaultConfig.ExcludedSwaggerPathsPattern,
        swaggerPaths,
        git: {
          url: "https://github.com/Azure/azure-rest-api-specs.git",
          shouldClone: false,
        },
        directory: path.resolve(os.homedir(), "repo"),
      };
      const validator = new LiveValidator({ swaggerPaths });
      assert.deepStrictEqual(validator.cache, {});
      assert.deepStrictEqual(validator.options, options);
    });
    it("should initialize with user provided swaggerPaths & directory", () => {
      const swaggerPaths = ["swaggerPath1", "swaggerPath2"];
      const directory = "/Users/username/repos/";
      const options = {
        swaggerPaths,
        excludedSwaggerPathsPattern: Constants.DefaultConfig.ExcludedSwaggerPathsPattern,
        isPathCaseSensitive: false,
        git: {
          url: "https://github.com/Azure/azure-rest-api-specs.git",
          shouldClone: false,
        },
        directory,
      };
      const validator = new LiveValidator({ swaggerPaths, directory });
      assert.deepStrictEqual(validator.cache, {});
      assert.deepStrictEqual(validator.options, options);
    });
    it("should initialize with user provided partial git configuration", () => {
      const swaggerPaths = ["swaggerPath1", "swaggerPath2"];
      const directory = "/Users/username/repos/";
      const git = {
        url: "https://github.com/Azure/azure-rest-api-specs.git",
        shouldClone: false,
      };
      const options = {
        swaggerPaths,
        excludedSwaggerPathsPattern: Constants.DefaultConfig.ExcludedSwaggerPathsPattern,
        isPathCaseSensitive: false,
        git: {
          url: git.url,
          shouldClone: false,
        },
        directory,
      };
      const validator = new LiveValidator({
        swaggerPaths,
        directory,
        git,
      });
      assert.deepStrictEqual(validator.cache, {});
      assert.deepStrictEqual(validator.options, options);
    });
    it("should initialize with user provided full git configuration", () => {
      const swaggerPaths = ["swaggerPath1", "swaggerPath2"];
      const directory = "/Users/username/repos/";
      const git = {
        url: "https://github.com/vladbarosan/azure-rest-api-specs.git",
        shouldClone: true,
        branch: "oav-test-branch",
      };
      const options = {
        swaggerPaths,
        excludedSwaggerPathsPattern: Constants.DefaultConfig.ExcludedSwaggerPathsPattern,
        git,
        directory,
        isPathCaseSensitive: false,
        loadValidatorInBackground: true,
        loadValidatorInInitialize: false,
      };
      const validator = new LiveValidator({
        swaggerPaths,
        directory,
        git,
      });
      assert.deepStrictEqual(validator.cache, {});
      assert.deepStrictEqual(validator.options, options);
    });
    it("should initialize with multiple path patterns", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "mediaservices/resource-manager/Microsoft.Media/2015-10-01/media.json",
          "rpsaas/resource-manager/Microsoft.Contoso/**/*.json",
        ],
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      assert.strictEqual(2, Object.keys(validator.cache).length);
      assert.strictEqual(true, "microsoft.media" in validator.cache);
      assert.strictEqual(true, "microsoft.contoso" in validator.cache);
    });
  });

  describe("Initialize cache", () => {
    it("should initialize for arm-mediaservices", async () => {
      const expectedProvider = "microsoft.media";
      const expectedApiVersion = "2015-10-01";
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "mediaservices/resource-manager/Microsoft.Media/2015-10-01/media.json",
        ],
      };
      const validator = new LiveValidator(options);
      try {
        await validator.initialize();
        assert.strictEqual(true, expectedProvider in validator.cache);
        assert.strictEqual(1, Object.keys(validator.cache).length);
        const x = validator.cache[expectedProvider];
        if (x === undefined) {
          throw new Error("x === undefined");
        }
        assert.strictEqual(true, expectedApiVersion in x);
        assert.strictEqual(1, Object.keys(x).length);
        assert.strictEqual(2, x[expectedApiVersion].get.length);
        assert.strictEqual(1, x[expectedApiVersion].put.length);
        assert.strictEqual(1, x[expectedApiVersion].patch.length);
        assert.strictEqual(1, x[expectedApiVersion].delete.length);
        assert.strictEqual(4, x[expectedApiVersion].post.length);
      } catch (err) {
        assert.ifError(err);
      }
    });
    it("should initialize for arm-resources", async () => {
      const expectedProvider = "microsoft.resources";
      const expectedApiVersion = "2016-09-01";
      const options = {
        directory: "./test/liveValidation/swaggers/",
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      assert.strictEqual(true, expectedProvider in validator.cache);
      assert.strictEqual(numberOfSpecs, Object.keys(validator.cache).length);
      const x = validator.cache[expectedProvider];
      if (x === undefined) {
        throw new Error("x === undefined");
      }
      assert.strictEqual(true, expectedApiVersion in x);
      assert.strictEqual(2, Object.keys(x).length);
      // 'microsoft.resources' -> '2016-09-01'
      assert.strictEqual(2, x[expectedApiVersion].get.length);
      assert.strictEqual(1, x[expectedApiVersion].delete.length);
      assert.strictEqual(3, x[expectedApiVersion].post.length);
      assert.strictEqual(1, x[expectedApiVersion].head.length);
      assert.strictEqual(1, x[expectedApiVersion].put.length);
      const p = validator.cache[Constants.unknownResourceProvider];
      if (p === undefined) {
        throw new Error("p === undefined");
      }
      // 'microsoft.unknown' -> 'unknown-api-version'
      assert.strictEqual(7, p[Constants.unknownApiVersion].post.length);
      assert.strictEqual(26, p[Constants.unknownApiVersion].get.length);
      assert.strictEqual(5, p[Constants.unknownApiVersion].head.length);
      assert.strictEqual(11, p[Constants.unknownApiVersion].put.length);
      assert.strictEqual(11, p[Constants.unknownApiVersion].delete.length);
      assert.strictEqual(3, p[Constants.unknownApiVersion].patch.length);
    });
    it("should initialize for batch", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "batch/resource-manager/Microsoft.Batch/stable/2017-01-01/BatchManagement.json",
        ],
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      assert.notStrictEqual(validator.cache["microsoft.batch"], undefined);
    });
    it("should initialize and ignore certain swaggers by default", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: ["batch/**/*.json"],
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      assert.strictEqual(1, Object.keys(validator.cache).length);
      const microsoftBatch = validator.cache["microsoft.batch"];
      if (microsoftBatch === undefined) {
        throw new Error("microsoftBatch === undefined");
      }
      // 2019-08-01 version should NOT be found as it is in data-plane and ignored
      assert.strictEqual(undefined, microsoftBatch["2019-08-01.10.0"]);
      // 2017-01-01 version should be found as it is in management-plane
      assert.strictEqual(7, microsoftBatch["2017-01-01"].get.length);
      assert.strictEqual(2, microsoftBatch["2017-01-01"].patch.length);
      assert.strictEqual(4, microsoftBatch["2017-01-01"].post.length);
    });
    it("should not ignore any swagger paths if options delcare no ignore path", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        excludedSwaggerPathsPattern: [],
        swaggerPathsPattern: ["batch/**/*.json"],
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      assert.strictEqual(1, Object.keys(validator.cache).length);
      const microsoftBatch = validator.cache["microsoft.batch"];
      if (microsoftBatch === undefined) {
        throw new Error("microsoftBatch === undefined");
      }
      // Should find two different api versions, one for data plane and one for management plane
      assert.strictEqual(1, microsoftBatch["2019-08-01.10.0"].get.length);
      assert.strictEqual(7, microsoftBatch["2017-01-01"].get.length);
      assert.strictEqual(2, microsoftBatch["2017-01-01"].patch.length);
      assert.strictEqual(4, microsoftBatch["2017-01-01"].post.length);
    });
    it("should ignore certain swaggers if exclued swagger path pattern is specified", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        excludedSwaggerPathsPattern: ["**/batch/data-plane/**/*"],
        swaggerPathsPattern: ["batch/**/*.json"],
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      assert.strictEqual(1, Object.keys(validator.cache).length);
      const microsoftBatch = validator.cache["microsoft.batch"];
      if (microsoftBatch === undefined) {
        throw new Error("microsoftBatch === undefined");
      }
      // 2019-08-01 version should NOT be found as it is in data-plane and ignored
      assert.strictEqual(undefined, microsoftBatch["2019-08-01.10.0"]);
      // 2017-01-01 version should be found as it is in management-plane
      assert.strictEqual(7, microsoftBatch["2017-01-01"].get.length);
      assert.strictEqual(2, microsoftBatch["2017-01-01"].patch.length);
      assert.strictEqual(4, microsoftBatch["2017-01-01"].post.length);
    });
    it("Exclude should take higher priority if included and excluded path collide", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        excludedSwaggerPathsPattern: ["**/batch/data-plane/**/*"],
        swaggerPathsPattern: ["**/batch/data-plane/**/*.json"],
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      assert.strictEqual(0, Object.keys(validator.cache).length);
    });
    it("should initialize for all swaggers", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/",
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      assert.strictEqual(numberOfSpecs, Object.keys(validator.cache).length);
      const microsoftResources = validator.cache["microsoft.resources"];
      if (microsoftResources === undefined) {
        throw new Error("microsoftResources === undefined");
      }
      assert.strictEqual(2, microsoftResources["2016-09-01"].get.length);
      assert.strictEqual(1, microsoftResources["2016-09-01"].head.length);
      const microsoftMedia = validator.cache["microsoft.media"];
      if (microsoftMedia === undefined) {
        throw new Error("microsoftMedia === undefined");
      }
      assert.strictEqual(1, microsoftMedia["2015-10-01"].patch.length);
      assert.strictEqual(4, microsoftMedia["2015-10-01"].post.length);
      const microsoftSearch = validator.cache["microsoft.search"];
      if (microsoftSearch === undefined) {
        throw new Error("microsoftSearch === undefined");
      }
      assert.strictEqual(2, microsoftSearch["2015-02-28"].get.length);
      assert.strictEqual(3, microsoftSearch["2015-08-19"].get.length);
      const microsoftStorage = validator.cache["microsoft.storage"];
      if (microsoftStorage === undefined) {
        throw new Error("microsoftStorage === undefined");
      }
      assert.strictEqual(1, microsoftStorage["2015-05-01-preview"].patch.length);
      assert.strictEqual(4, microsoftStorage["2015-06-15"].get.length);
      assert.strictEqual(3, microsoftStorage["2016-01-01"].post.length);
      const microsoftTest = validator.cache["microsoft.test"];
      if (microsoftTest === undefined) {
        throw new Error("microsoftTest === undefined");
      }
      assert.strictEqual(4, microsoftTest["2016-01-01"].post.length);
    });
  });

  describe("Initialize cache and search", () => {
    it("should return zero result when search for unknown method in unknown RP unknown apiversion operations", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification/unknown-rp",
        swaggerPathsPattern: ["**/*.json"],
      };
      const requestUrl =
        "https://management.azure.com/" +
        "subscriptions/randomSub/resourceGroups/randomRG/providers/providers/Microsoft.Storage" +
        "/3fa73e4b-d60d-43b2-a248-fb776fd0bf60" +
        "?api-version=2018-09-01-preview";
      const validator: any = new LiveValidator(options);
      await validator.initialize();
      // Operations to match is RoleAssignments_Create
      const validationInfo = validator.parseValidationRequest(requestUrl, "Put", "randomId");
      const operations = validator.getPotentialOperations(validationInfo).operations;
      assert.strictEqual(0, operations.length);
    });
    it("should fall back to return child operation in case of request url have parent and child resouces", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification/authorization",
        swaggerPathsPattern: ["**/*.json"],
      };
      const requestUrl =
        "https://management.azure.com/" +
        "subscriptions/randomSub/resourceGroups/randomRG/providers/providers/Microsoft.Storage" +
        "/storageAccounts/storageoy6qv/blobServices/default/containers" +
        "/privatecontainer/providers/Microsoft.Authorization/roleAssignments" +
        "/3fa73e4b-d60d-43b2-a248-fb776fd0bf60" +
        "?api-version=2018-09-01-preview";
      const validator = new LiveValidator(options);
      await validator.initialize();
      // Operations to match is RoleAssignments_Create
      const validationInfo = validator.parseValidationRequest(requestUrl, "Put", "randomId");
      // eslint-disable-next-line dot-notation
      const operations = validator["getPotentialOperations"](validationInfo).operations;
      const pathObject = operations[0].operation._path;
      if (pathObject === undefined) {
        throw new Error("pathObject is undefined");
      }
      assert.strictEqual(1, operations.length);
      assert.strictEqual(
        "/{scope}/providers/Microsoft.Authorization/roleAssignments/{roleAssignmentName}",
        pathObject._pathTemplate
      );
    });
    it("should return one matched operation for arm-storage", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/",
      };
      const listRequestUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts" +
        "?api-version=2015-06-15";
      const postRequestUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Microsoft.Storage/checkNameAvailability" +
        "?api-version=2015-06-15";
      const deleteRequestUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/resourceGroups/myRG/providers/Microsoft.Storage/" +
        "storageAccounts/accname?api-version=2015-06-15";
      const validator = new LiveValidator(options);
      await validator.initialize();
      // Operations to match is StorageAccounts_List
      let validationInfo = validator.parseValidationRequest(listRequestUrl, "Get", "randomId");
      // eslint-disable-next-line dot-notation
      let operations = validator["getPotentialOperations"](validationInfo).operations;
      let pathObject = operations[0].operation._path;
      if (pathObject === undefined) {
        throw new Error("pathObject is undefined");
      }
      assert.strictEqual(1, operations.length);
      assert.strictEqual(
        "/subscriptions/{subscriptionId}/providers/Microsoft.Storage/storageAccounts",
        pathObject._pathTemplate
      );

      // Operations to match is StorageAccounts_CheckNameAvailability
      validationInfo = validator.parseValidationRequest(postRequestUrl, "PoSt", "randomId");
      // eslint-disable-next-line dot-notation
      operations = validator["getPotentialOperations"](validationInfo).operations;
      pathObject = operations[0].operation._path;
      if (pathObject === undefined) {
        throw new Error("pathObject is undefined");
      }
      assert.strictEqual(1, operations.length);
      assert.strictEqual(
        "/subscriptions/{subscriptionId}/providers/Microsoft.Storage/checkNameAvailability",
        pathObject._pathTemplate
      );

      // Operations to match is StorageAccounts_Delete
      validationInfo = validator.parseValidationRequest(deleteRequestUrl, "Delete", "randomId");
      // eslint-disable-next-line dot-notation
      operations = validator["getPotentialOperations"](validationInfo).operations;
      pathObject = operations[0].operation._path;
      if (pathObject === undefined) {
        throw new Error("pathObject is undefined");
      }
      assert.strictEqual(1, operations.length);
      assert.strictEqual(
        "/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/" +
          "Microsoft.Storage/storageAccounts/{accountName}",
        pathObject._pathTemplate
      );
    });
    it("should return reason for not matched operations", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/",
      };
      const nonCachedApiUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts" +
        "?api-version=2015-08-15";
      const nonCachedProviderUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Hello.World/checkNameAvailability" +
        "?api-version=2015-06-15";
      const nonCachedVerbUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/resourceGroups/myRG/providers/Microsoft.Storage/" +
        "storageAccounts/accname?api-version=2015-06-15";
      const nonCachedPath =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts/accountName/" +
        "properties?api-version=2015-06-15";
      const validator: any = new LiveValidator(options);
      await validator.initialize();
      // Operations to match is StorageAccounts_List with api-version 2015-08-15
      // [non cached api version]
      let validationInfo = validator.parseValidationRequest(nonCachedApiUrl, "Get", "randomId");
      let result = validator.getPotentialOperations(validationInfo);
      let operations = result.operations;
      let reason = result.reason;
      assert.strictEqual(0, operations.length);
      if (reason === undefined) {
        throw new Error("reason is undefined");
      }
      assert.strictEqual(Constants.ErrorCodes.OperationNotFoundInCacheWithApi.name, reason.code);

      // Operations to match is StorageAccounts_CheckNameAvailability with provider "Hello.World"
      // [non cached provider]
      validationInfo = validator.parseValidationRequest(nonCachedProviderUrl, "PoSt", "randomId");
      result = validator.getPotentialOperations(validationInfo);
      operations = result.operations;
      reason = result.reason;
      assert.strictEqual(0, operations.length);
      if (reason === undefined) {
        throw new Error("reason is undefined");
      }
      assert.strictEqual(
        Constants.ErrorCodes.OperationNotFoundInCacheWithProvider.name,
        reason.code
      );

      // Operations to match is StorageAccounts_Delete with verb "head" [non cached http verb]
      validationInfo = validator.parseValidationRequest(nonCachedVerbUrl, "head", "randomId");
      result = validator.getPotentialOperations(validationInfo);
      operations = result.operations;
      reason = result.reason;
      assert.strictEqual(0, operations.length);
      if (reason === undefined) {
        throw new Error("reason is undefined");
      }
      assert.strictEqual(Constants.ErrorCodes.OperationNotFoundInCacheWithVerb.name, reason.code);

      // Operations to match is with path
      // "subscriptions/subscriptionId/providers/Microsoft.Storage/" +
      // "storageAccounts/storageAccounts/accountName/properties/"
      // [non cached path]
      validationInfo = validator.parseValidationRequest(nonCachedPath, "get", "randomId");
      result = validator.getPotentialOperations(validationInfo);
      operations = result.operations;
      reason = result.reason;
      assert.strictEqual(0, operations.length);
      if (reason === undefined) {
        throw new Error("reason is undefined");
      }
      assert.strictEqual(Constants.ErrorCodes.OperationNotFoundInCache.name, reason.code);
    });
    it("it shouldn't create an implicit default response", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification/scenarios",
        swaggerPathsPattern: ["**/*.json"],
        shouldModelImplicitDefaultResponse: true,
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      const microsoftTest = validator.cache["microsoft.test"];
      if (microsoftTest === undefined) {
        throw new Error("microsoftTest === undefined");
      }
      // Operations to match is StorageAccounts_List
      const operations = microsoftTest["2016-01-01"].post;

      for (const operation of operations) {
        const responses = operation.responses as ResponsesObject;
        assert.strictEqual(responses.default, undefined);
      }
    });
  });

  describe("Initialize cache and validate", () => {
    const livePaths = globby.sync(
      path.join(__dirname, "test/liveValidation/swaggers/**/live/*.json")
    );
    livePaths.forEach((livePath) => {
      it(`should validate request and response for "${livePath}"`, async () => {
        const options = {
          directory: "./test/liveValidation/swaggers/specification/storage",
          swaggerPathsPattern: ["**/*.json"],
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
      // Should be able to find Microsoft.Storage with 2015-05-01-preview api version succesfully
      const errors = result.responseValidationResult.errors;
      assert.deepStrictEqual(errors, []);
      assert.equal(result.responseValidationResult.isSuccessful, true);
      assert.equal(typeof result.responseValidationResult.runtimeException, "undefined");
    });

    it("should not match to Microsoft.Resources for the unknown resourceprovider", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/",
        swaggerPathsPattern: [
          "specification\\resources\\resource-manager\\Microsoft.Resources\\2015-11-01\\*.json",
        ],
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
    });

    it("should initialize for defaultErrorOnly and pass", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification/defaultIsErrorOnly",
        swaggerPathsPattern: ["test.json"],
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
  });
});
describe("Live validator snapshot validation", () => {
  let validator: LiveValidator;
  let validatorOneOf: LiveValidator;
  const errors = [
    "OBJECT_MISSING_REQUIRED_PROPERTY",
    "OBJECT_ADDITIONAL_PROPERTIES",
    "MISSING_REQUIRED_PARAMETER",
    "MAX_LENGTH",
    "INVALID_FORMAT",
    "INVALID_TYPE",
    "ENUM_MISMATCH",
    "ENUM_CASE_MISMATCH",
    "SECRET_PROPERTY",
    "WRITEONLY_PROPERTY_NOT_ALLOWED_IN_RESPONSE",
  ];
  beforeAll(async () => {
    const options = {
      directory: `${__dirname}/liveValidation/swaggers/`,
      isPathCaseSensitive: false,
      useRelativeSourceLocationUrl: true,
      swaggerPathsPattern: [
        "specification\\apimanagement\\resource-manager\\Microsoft.ApiManagement\\preview\\2018-01-01\\*.json",
      ],
      git: {
        shouldClone: false,
      },
    };
    validator = new LiveValidator(options);
    await validator.initialize();
    options.swaggerPathsPattern = [
      "specification\\mediaservices\\resource-manager\\Microsoft.Media\\2018-07-01\\*.json",
    ];
    validatorOneOf = new LiveValidator(options);
    await validatorOneOf.initialize();
  }, 100000);

  test(`should return no errors for valid input`, async () => {
    const payload = require(`${__dirname}/liveValidation/payloads/valid_input.json`);
    const validationResult = await validator.validateLiveRequestResponse(payload);
    expect(validationResult).toMatchSnapshot();
  });

  test(`should return expected error for multiple operation found`, async () => {
    const options = {
      directory: `${__dirname}/liveValidation/swaggers/`,
      isPathCaseSensitive: false,
      useRelativeSourceLocationUrl: true,
      swaggerPathsPattern: [
        "specification\\mediaservices\\resource-manager\\Microsoft.Media\\**\\*.json",
      ],
      git: {
        shouldClone: false,
      },
    };
    const liveValidator = new LiveValidator(options);
    await liveValidator.initialize();

    const payload = require(`${__dirname}/liveValidation/payloads/multiplePperationFound_input`);
    const result = await liveValidator.validateLiveRequestResponse(payload);
    expect(
      result.responseValidationResult.runtimeException &&
        result.responseValidationResult.runtimeException.code === "MULTIPLE_OPERATIONS_FOUND"
    );
    expect(
      result.responseValidationResult.runtimeException &&
        result.responseValidationResult.runtimeException.message.indexOf(
          "specification/mediaservices/resource-manager/Microsoft.Media/2018-07-01/AssetsAndAssetFilters.json"
        ) >= 0
    );
    expect(
      result.responseValidationResult.runtimeException &&
        result.responseValidationResult.runtimeException.message.indexOf(
          "specification/mediaservices/resource-manager/Microsoft.Media/2019-05-01-preview/AssetsAndAssetFilters.json"
        ) >= 0
    );
  });

  test(`should return expected error for readonly property in the request`, async () => {
    const options = {
      directory: `${__dirname}/liveValidation/swaggers/`,
      isPathCaseSensitive: false,
      useRelativeSourceLocationUrl: true,
      swaggerPathsPattern: [
        "specification\\contoso\\resource-manager\\Microsoft.Contoso\\**\\*.json",
      ],
      git: {
        shouldClone: false,
      },
    };
    const liveValidator = new LiveValidator(options);
    await liveValidator.initialize();

    const payload = require(`${__dirname}/liveValidation/payloads/readonlyProperty_input.json`);
    const result = await liveValidator.validateLiveRequestResponse(payload);
    expect(result).toMatchSnapshot();
  });

  /**
   * this case is invalid because we can detect unresolved reference erro in the stage of resolve spec
   * TODO: this error code should be removed from the doc later
   */
  test.skip(`should return expected error for unresolvable reference`, async () => {
    const options = {
      directory: `${__dirname}/liveValidation/swaggers/`,
      isPathCaseSensitive: false,
      useRelativeSourceLocationUrl: true,
      swaggerPathsPattern: [
        "specification\\rpsaas\\resource-manager\\Microsoft.Contoso\\stable\\2019-01-01\\*.json",
      ],
      git: {
        shouldClone: false,
      },
    };
    const liveValidator = new LiveValidator(options);
    await liveValidator.initialize();

    const payload = require(`${__dirname}/liveValidation/payloads/unresolvableReference_input.json`);
    const result = await liveValidator.validateLiveRequest(payload.input.request, {
      includeErrors: ["UNRESOLVABLE_REFERENCE"],
    });
    expect(result.isSuccessful === false);
    expect(result.errors[0].code === "UNRESOLVABLE_REFERENCE");
  });

  errors.forEach((error) => {
    test(`should return the expected error requestResponse validation for ${error}`, async () => {
      const payload = require(`${__dirname}/liveValidation/payloads/${lodash.camelCase(
        error
      )}_input.json`);
      const validationResult = await validator.validateLiveRequestResponse(payload);
      expect(validationResult).toMatchSnapshot();
    });

    test(`should match pair validation with response request validation for ${error}`, async () => {
      const payload = require(`${__dirname}/liveValidation/payloads/${lodash.camelCase(
        error
      )}_input.json`);
      const validationResult = await validator.validateLiveRequestResponse(payload);
      const requestValidationResult = await validator.validateLiveRequest(payload.liveRequest);
      const responseValidationResult = await validator.validateLiveResponse(payload.liveResponse, {
        url: payload.liveRequest.url,
        method: payload.liveRequest.method,
      });
      expect(validationResult.requestValidationResult).toStrictEqual(requestValidationResult);
      expect(validationResult.responseValidationResult).toStrictEqual(responseValidationResult);
    });
  });
  test(`should match for one of missing`, async () => {
    const payload = require(`${__dirname}/liveValidation/payloads/oneOfMissing_input.json`);
    const result = await validatorOneOf.validateLiveRequestResponse(payload);
    expect(result).toMatchSnapshot();
  });
  test(`should return all errors for no options`, async () => {
    const payload = require(`${__dirname}/liveValidation/payloads/multipleErrors_input.json`);
    const result = await validator.validateLiveRequestResponse(payload);
    expect(result.responseValidationResult.errors.length === 3);
    expect(result.responseValidationResult.errors.some((err) => err.code === "INVALID_TYPE"));
    expect(result.responseValidationResult.errors.some((err) => err.code === "INVALID_FORMAT"));
    expect(
      result.responseValidationResult.errors.some(
        (err) => err.code === "OBJECT_ADDITIONAL_PROPERTIES"
      )
    );
  });
  test(`should match all errors for no options`, async () => {
    const payload = require(`${__dirname}/liveValidation/payloads/multipleErrors_input.json`);
    const result = await validator.validateLiveRequestResponse(payload);
    expect(result).toMatchSnapshot();
  });
  test(`should return all errors for empty includeErrors list`, async () => {
    const payload = require(`${__dirname}/liveValidation/payloads/multipleErrors_input.json`);
    const result = await validator.validateLiveRequestResponse(payload, { includeErrors: [] });
    expect(result.responseValidationResult.errors.length === 3);
    expect(result.responseValidationResult.errors.some((err) => err.code === "INVALID_TYPE"));
    expect(result.responseValidationResult.errors.some((err) => err.code === "INVALID_FORMAT"));
    expect(
      result.responseValidationResult.errors.some(
        (err) => err.code === "OBJECT_ADDITIONAL_PROPERTIES"
      )
    );
  });

  test(`should return only errors specified  in the list`, async () => {
    const payload = require(`${__dirname}/liveValidation/payloads/multipleErrors_input.json`);
    const result = await validator.validateLiveRequestResponse(payload, {
      includeErrors: ["INVALID_TYPE"],
    });
    expect(result.responseValidationResult.errors.length === 1);
    expect(result.responseValidationResult.errors[0].code === "INVALID_TYPE");
  });
});
