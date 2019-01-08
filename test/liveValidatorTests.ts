// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as assert from "assert"
import * as path from "path"
import * as os from "os"
import * as glob from "glob"
import { LiveValidator } from "../lib/validators/liveValidator"
import * as Constants from "../lib/util/constants"
import { ResponsesObject } from "yasway"

const numberOfSpecs = 8
const livePaths = glob.sync(path.join(
  __dirname,
  "..",
  "..",
  "test/liveValidation/swaggers/**/live/*.json")
)
describe("Live Validator", () => {
  describe("Initialization", () => {
    it("should initialize with defaults", () => {
      const options = {
        swaggerPaths: [],
        git: {
          url: "https://github.com/Azure/azure-rest-api-specs.git",
          shouldClone: false
        },
        directory: path.resolve(os.homedir(), "repo")
      };
      const validator = new LiveValidator()
      assert.deepStrictEqual(validator.cache, {})
      assert.deepStrictEqual(validator.options, options)
    })
    it("should initialize with cloning", async () => {
      const options = {
        swaggerPaths: [],
        git: {
          url: "https://github.com/Azure/oav.git",
          shouldClone: true
        },
        directory: path.resolve(os.homedir(), "repo")
      };
      const validator = new LiveValidator(options)
      await validator.initialize()
      assert.deepStrictEqual(validator.cache, {})
      assert.deepStrictEqual(validator.options, options)
    })
    it("should initialize without url", () => {
      const options = {
        swaggerPaths: [],
        git: {
          shouldClone: false
        },
        directory: path.resolve(os.homedir(), "repo")
      };
      const validator = new LiveValidator(options)
      assert.deepStrictEqual(validator.cache, {})
      assert.deepStrictEqual(
        validator.options.git.url, "https://github.com/Azure/azure-rest-api-specs.git"
      )
    })
    it("should throw during initialization with invalid directory", () => {
      assert.throws(() => {
        const options = {
          swaggerPaths: [],
          git: {
            shouldClone: false
          },
          directory: 54
        };
        const validator = new LiveValidator(options)
        assert.notStrictEqual(validator, null)
      })
    })
    it("should initialize with user provided swaggerPaths", () => {
      const swaggerPaths = ["swaggerPath1", "swaggerPath2"]
      const options = {
        swaggerPaths: swaggerPaths,
        git: {
          url: "https://github.com/Azure/azure-rest-api-specs.git",
          shouldClone: false
        },
        directory: path.resolve(os.homedir(), "repo")
      }
      const validator = new LiveValidator({ swaggerPaths: swaggerPaths })
      assert.deepStrictEqual(validator.cache, {})
      assert.deepStrictEqual(validator.options, options)
    })
    it("should initialize with user provided swaggerPaths & directory", () => {
      const swaggerPaths = ["swaggerPath1", "swaggerPath2"]
      const directory = "/Users/username/repos/"
      const options = {
        swaggerPaths: swaggerPaths,
        git: {
          url: "https://github.com/Azure/azure-rest-api-specs.git",
          shouldClone: false
        },
        directory: directory
      }
      const validator = new LiveValidator({ swaggerPaths: swaggerPaths, directory: directory })
      assert.deepStrictEqual(validator.cache, {})
      assert.deepStrictEqual(validator.options, options)
    })
    it("should initialize with user provided partial git configuration", () => {
      const swaggerPaths = ["swaggerPath1", "swaggerPath2"]
      const directory = "/Users/username/repos/"
      const git = {
        url: "https://github.com/Azure/azure-rest-api-specs.git"
      }
      const options = {
        swaggerPaths: swaggerPaths,
        git: {
          url: git.url,
          shouldClone: false
        },
        directory: directory
      }
      const validator = new LiveValidator({
        swaggerPaths: swaggerPaths, directory: directory, git: git })
      assert.deepStrictEqual(validator.cache, {})
      assert.deepStrictEqual(validator.options, options)
    })
    it("should initialize with user provided full git configuration", () => {
      const swaggerPaths = ["swaggerPath1", "swaggerPath2"]
      const directory = "/Users/username/repos/"
      const git = {
        url: "https://github.com/vladbarosan/azure-rest-api-specs.git",
        shouldClone: true,
        branch: "oav-test-branch"
      }
      const options = {
        swaggerPaths: swaggerPaths,
        git: git,
        directory: directory
      }
      const validator = new LiveValidator({
        swaggerPaths: swaggerPaths, directory: directory, git: git })
      assert.deepStrictEqual(validator.cache, {})
      assert.deepStrictEqual(validator.options, options)
    })
    it("should throw on invalid options types", () => {
      assert.throws(
        () => {
          const _ = new LiveValidator("string")
          assert.notStrictEqual(_, null)
        },
        /must be of type "object"/)
      assert.throws(
        () => {
          const _ = new LiveValidator({ swaggerPaths: "should be array" })
          assert.notStrictEqual(_, null)
        },
        /must be of type "array"/)
      assert.throws(
        () => {
          const _ = new LiveValidator({ git: 1 })
          assert.notStrictEqual(_, null)
        },
        /must be of type "object"/)
      assert.throws(
        () => {
          const _ = new LiveValidator({ git: { url: [] } })
          assert.notStrictEqual(_, null)
        },
        /must be of type "string"/)
      assert.throws(
        () => {
          const _ = new LiveValidator({ git: { url: "url", shouldClone: "no" } })
          assert.notStrictEqual(_, null)
        },
        /must be of type "boolean"/)
    })
  })

  describe("Initialize cache", () => {
    it("should initialize for arm-mediaservices", async () => {
      const expectedProvider = "microsoft.media"
      const expectedApiVersion = "2015-10-01"
      const options = {
        directory: "./test/liveValidation/swaggers/"
      }
      const validator = new LiveValidator(options)
      try {
        await validator.initialize()
        assert.strictEqual(true, expectedProvider in validator.cache)
        assert.strictEqual(numberOfSpecs, Object.keys(validator.cache).length)
        const x = validator.cache[expectedProvider]
        if (x === undefined) {
          throw new Error("x === undefined")
        }
        assert.strictEqual(true, expectedApiVersion in x)
        assert.strictEqual(1, Object.keys(x).length)
        assert.strictEqual(2, x[expectedApiVersion].get.length)
        assert.strictEqual(1, x[expectedApiVersion].put.length)
        assert.strictEqual(1, x[expectedApiVersion].patch.length)
        assert.strictEqual(1, x[expectedApiVersion].delete.length)
        assert.strictEqual(4, x[expectedApiVersion].post.length)
      } catch (err) {
        assert.ifError(err)
      }
    })
    it("should initialize for arm-resources", async () => {
      const expectedProvider = "microsoft.resources"
      const expectedApiVersion = "2016-09-01"
      const options = {
        directory: "./test/liveValidation/swaggers/"
      }
      const validator = new LiveValidator(options)
      await validator.initialize()
      assert.strictEqual(true, expectedProvider in validator.cache)
      assert.strictEqual(numberOfSpecs, Object.keys(validator.cache).length)
      const x = validator.cache[expectedProvider]
      if (x === undefined) {
        throw new Error("x === undefined")
      }
      assert.strictEqual(true, expectedApiVersion in x)
      assert.strictEqual(1, Object.keys(x).length)
      // 'microsoft.resources' -> '2016-09-01'
      assert.strictEqual(2, x[expectedApiVersion].get.length)
      assert.strictEqual(1, x[expectedApiVersion].delete.length)
      assert.strictEqual(3, x[expectedApiVersion].post.length)
      assert.strictEqual(1, x[expectedApiVersion].head.length)
      assert.strictEqual(1, x[expectedApiVersion].put.length)
      const p = validator.cache[Constants.unknownResourceProvider]
      if (p === undefined) {
        throw new Error("p === undefined")
      }
      // 'microsoft.unknown' -> 'unknown-api-version'
      assert.strictEqual(
        4,
        p[Constants.unknownApiVersion].post.length)
      assert.strictEqual(
        11,
        p[Constants.unknownApiVersion].get.length)
      assert.strictEqual(
        3,
        p[Constants.unknownApiVersion].head.length)
      assert.strictEqual(
        5,
        p[Constants.unknownApiVersion].put.length)
      assert.strictEqual(
        5,
        p[Constants.unknownApiVersion].delete.length)
      assert.strictEqual(
        1,
        p[Constants.unknownApiVersion].patch.length)
    })
    it("should initialize for batch", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern:
          "batch/resource-manager/Microsoft.Batch/stable/2017-01-01/BatchManagement.json"
      }
      const validator = new LiveValidator(options)
      await validator.initialize()
      assert.notStrictEqual(validator.cache["microsoft.batch"], undefined)
    })
    it("should initialize for all swaggers", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/"
      }
      const validator = new LiveValidator(options)
      await validator.initialize()
      assert.strictEqual(numberOfSpecs, Object.keys(validator.cache).length)
      const microsoftResources = validator.cache["microsoft.resources"]
      if (microsoftResources === undefined) {
        throw new Error("microsoftResources === undefined")
      }
      assert.strictEqual(2, microsoftResources["2016-09-01"].get.length)
      assert.strictEqual(1, microsoftResources["2016-09-01"].head.length)
      const microsoftMedia = validator.cache["microsoft.media"]
      if (microsoftMedia === undefined) {
        throw new Error("microsoftMedia === undefined")
      }
      assert.strictEqual(1, microsoftMedia["2015-10-01"].patch.length)
      assert.strictEqual(4, microsoftMedia["2015-10-01"].post.length)
      const microsoftSearch = validator.cache["microsoft.search"]
      if (microsoftSearch === undefined) {
        throw new Error("microsoftSearch === undefined")
      }
      assert.strictEqual(2, microsoftSearch["2015-02-28"].get.length)
      assert.strictEqual(3, microsoftSearch["2015-08-19"].get.length)
      const microsoftStorage = validator.cache["microsoft.storage"]
      if (microsoftStorage === undefined) {
        throw new Error("microsoftStorage === undefined")
      }
      assert.strictEqual(1, microsoftStorage["2015-05-01-preview"].patch.length)
      assert.strictEqual(4, microsoftStorage["2015-06-15"].get.length)
      assert.strictEqual(3, microsoftStorage["2016-01-01"].post.length)
      const microsoftTest = validator.cache["microsoft.test"]
      if (microsoftTest === undefined) {
        throw new Error("microsoftTest === undefined")
      }
      assert.strictEqual(4, microsoftTest["2016-01-01"].post.length)
    })
  })

  describe("Initialize cache and search", () => {
    it("should return one matched operation for arm-storage", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/"
      }
      const listRequestUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts" +
        "?api-version=2015-06-15"
      const postRequestUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Microsoft.Storage/checkNameAvailability" +
        "?api-version=2015-06-15"
      const deleteRequestUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/resourceGroups/myRG/providers/Microsoft.Storage/" +
        "storageAccounts/accname?api-version=2015-06-15"
      const validator = new LiveValidator(options)
      await validator.initialize()
      // Operations to match is StorageAccounts_List
      let operations = validator.getPotentialOperations(listRequestUrl, "Get").operations
      let pathObject = operations[0].pathObject
      if (pathObject === undefined) {
        throw new Error("pathObject is undefined")
      }
      assert.strictEqual(1, operations.length)
      assert.strictEqual(
        "/subscriptions/{subscriptionId}/providers/Microsoft.Storage/storageAccounts",
        pathObject.path)

      // Operations to match is StorageAccounts_CheckNameAvailability
      operations = validator.getPotentialOperations(postRequestUrl, "PoSt").operations
      pathObject = operations[0].pathObject
      if (pathObject === undefined) {
        throw new Error("pathObject is undefined")
      }
      assert.strictEqual(1, operations.length)
      assert.strictEqual(
        "/subscriptions/{subscriptionId}/providers/Microsoft.Storage/checkNameAvailability",
        pathObject.path)

      // Operations to match is StorageAccounts_Delete
      operations = validator.getPotentialOperations(deleteRequestUrl, "delete").operations
      pathObject = operations[0].pathObject
      if (pathObject === undefined) {
        throw new Error("pathObject is undefined")
      }
      assert.strictEqual(1, operations.length)
      assert.strictEqual(
        "/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/" +
          "Microsoft.Storage/storageAccounts/{accountName}",
        pathObject.path)
    })
    it("should return reason for not matched operations", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/"
      }
      const nonCachedApiUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts" +
        "?api-version=2015-08-15"
      const nonCachedProviderUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Hello.World/checkNameAvailability" +
        "?api-version=2015-06-15"
      const nonCachedVerbUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/resourceGroups/myRG/providers/Microsoft.Storage/" +
        "storageAccounts/accname?api-version=2015-06-15"
      const nonCachedPath =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts/accountName/" +
        "properties?api-version=2015-06-15"
      const validator = new LiveValidator(options)
      await validator.initialize()
      // Operations to match is StorageAccounts_List with api-version 2015-08-15
      // [non cached api version]
      let result = validator.getPotentialOperations(nonCachedApiUrl, "Get")
      let operations = result.operations
      let reason = result.reason
      assert.strictEqual(0, operations.length)
      if (reason === undefined) {
        throw new Error("reason is undefined")
      }
      assert.strictEqual(Constants.ErrorCodes.OperationNotFoundInCacheWithApi.name, reason.code)

      // Operations to match is StorageAccounts_CheckNameAvailability with provider "Hello.World"
      // [non cached provider]
      result = validator.getPotentialOperations(nonCachedProviderUrl, "PoSt")
      operations = result.operations
      reason = result.reason
      assert.strictEqual(0, operations.length)
      if (reason === undefined) {
        throw new Error("reason is undefined")
      }
      assert.strictEqual(
        Constants.ErrorCodes.OperationNotFoundInCacheWithProvider.name,
        reason.code
      )

      // Operations to match is StorageAccounts_Delete with verb "head" [non cached http verb]
      result = validator.getPotentialOperations(nonCachedVerbUrl, "head")
      operations = result.operations
      reason = result.reason
      assert.strictEqual(0, operations.length)
      if (reason === undefined) {
        throw new Error("reason is undefined")
      }
      assert.strictEqual(Constants.ErrorCodes.OperationNotFoundInCacheWithVerb.name, reason.code)

      // Operations to match is with path
      // "subscriptions/subscriptionId/providers/Microsoft.Storage/" +
      // "storageAccounts/storageAccounts/accountName/properties/"
      // [non cached path]
      result = validator.getPotentialOperations(nonCachedPath, "get")
      operations = result.operations
      reason = result.reason
      assert.strictEqual(0, operations.length)
      if (reason === undefined) {
        throw new Error("reason is undefined")
      }
      assert.strictEqual(Constants.ErrorCodes.OperationNotFoundInCache.name, reason.code)
    })
    it("it shouldn't create an implicit default response", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification/scenarios",
        swaggerPathsPattern: "**/*.json",
        shouldModelImplicitDefaultResponse: true
      }
      const validator = new LiveValidator(options)
      await validator.initialize()
      const microsoftTest = validator.cache["microsoft.test"]
      if (microsoftTest === undefined) {
        throw new Error("microsoftTest === undefined")
      }
      // Operations to match is StorageAccounts_List
      const operations = microsoftTest["2016-01-01"].post

      for (const operation of operations) {
        const responses = operation.responses as ResponsesObject
        assert.strictEqual(responses.default, undefined)
      }
    })
  })

  describe("Initialize cache and validate", () => {
    livePaths.forEach(livePath => {
      it(`should validate request and response for "${livePath}"`, async () => {
        const options = {
          directory: "./test/liveValidation/swaggers/specification/storage",
          swaggerPathsPattern: "**/*.json"
        }
        const validator = new LiveValidator(options)
        await validator.initialize()
        const reqRes = require(livePath)
        const validationResult = validator.validateLiveRequestResponse(reqRes)
        assert.notStrictEqual(validationResult, undefined)
        /* tslint:disable-next-line */
        // console.dir(validationResult, { depth: null, colors: true })
      })
    })
    it("should initialize for defaultErrorOnly and fail on unknown status code", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification/defaultIsErrorOnly",
        swaggerPathsPattern: "test.json"
      }
      const validator = new LiveValidator(options)
      await validator.initialize()
      const result = validator.validateLiveRequestResponse({
        liveRequest: {
          url: "https://xxx.com/providers/someprovider?api-version=2018-01-01",
          method: "get",
          headers: {
            "content-type": "application/json",
          },
          query: {
            "api-version": "2016-01-01"
          }
        },
        liveResponse: {
          statusCode: "300",
          headers: {
            "content-Type": "application/json"
          }
        }
      })
      const errors = result.responseValidationResult.errors
      if (errors === undefined) {
        throw new Error("errors === undefined")
      }
      assert.strictEqual((errors[0] as any).code, "INVALID_RESPONSE_CODE")
    })
    it("should initialize for defaultErrorOnly and pass", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification/defaultIsErrorOnly",
        swaggerPathsPattern: "test.json"
      }
      const validator = new LiveValidator(options)
      await validator.initialize()
      const result = validator.validateLiveRequestResponse({
        liveRequest: {
          url: "https://xxx.com/providers/someprovider?api-version=2018-01-01",
          method: "get",
          headers: {
            "content-type": "application/json",
          },
          query: {
            "api-version": "2016-01-01"
          }
        },
        liveResponse: {
          statusCode: "404",
          headers: {
            "content-Type": "application/json"
          }
        }
      })
      const errors = result.responseValidationResult.errors
      assert.deepStrictEqual(errors, [])
    })
  })

})
