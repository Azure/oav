// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import assert from "assert"
import * as path from "path"
import * as os from "os"
import * as glob from "glob"
import { LiveValidator } from "../lib/validators/liveValidator"
import * as Constants from "../lib/util/constants"
import * as utils from "../lib/util/utils"
import { ResponsesObject } from "yasway"

const livePaths = glob.sync(path.join(__dirname, "liveValidation/swaggers/**/live/*.json"))
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
      assert.deepEqual(validator.cache, {})
      assert.deepEqual(validator.options, options)
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
      assert.deepEqual(validator.cache, {})
      assert.deepEqual(validator.options, options)
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
      assert.deepEqual(validator.cache, {})
      assert.deepEqual(
        validator.options.git.url, "https://github.com/Azure/azure-rest-api-specs.git")
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
        assert.notEqual(validator, null)
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
      assert.deepEqual(validator.cache, {})
      assert.deepEqual(validator.options, options)
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
      assert.deepEqual(validator.cache, {})
      assert.deepEqual(validator.options, options)
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
      assert.deepEqual(validator.cache, {})
      assert.deepEqual(validator.options, options)
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
      assert.deepEqual(validator.cache, {})
      assert.deepEqual(validator.options, options)
    })
    it("should throw on invalid options types", () => {
      assert.throws(() => {
        const _ = new LiveValidator("string")
        assert.notEqual(_, null)
      }, /must be of type "object"/)
      assert.throws(() => {
        const _ = new LiveValidator({ swaggerPaths: "should be array" })
        assert.notEqual(_, null)
      }, /must be of type "array"/)
      assert.throws(() => {
        const _ = new LiveValidator({ git: 1 })
        assert.notEqual(_, null)
      }, /must be of type "object"/)
      assert.throws(() => {
        const _ = new LiveValidator({ git: { url: [] } })
        assert.notEqual(_, null)
      }, /must be of type "string"/)
      assert.throws(() => {
        const _ = new LiveValidator({ git: { url: "url", shouldClone: "no" } })
        assert.notEqual(_, null)
      }, /must be of type "boolean"/)
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
        assert.equal(true, expectedProvider in validator.cache)
        assert.equal(6, Object.keys(validator.cache).length)
        assert.equal(true, expectedApiVersion in (validator.cache[expectedProvider]))
        assert.equal(1, Object.keys(validator.cache[expectedProvider]).length)
        assert.equal(2, validator.cache[expectedProvider][expectedApiVersion].get.length)
        assert.equal(1, validator.cache[expectedProvider][expectedApiVersion].put.length)
        assert.equal(1, validator.cache[expectedProvider][expectedApiVersion].patch.length)
        assert.equal(1, validator.cache[expectedProvider][expectedApiVersion].delete.length)
        assert.equal(4, validator.cache[expectedProvider][expectedApiVersion].post.length)
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
      assert.equal(true, expectedProvider in validator.cache)
      assert.equal(6, Object.keys(validator.cache).length)
      assert.equal(true, expectedApiVersion in (validator.cache[expectedProvider]))
      assert.equal(1, Object.keys(validator.cache[expectedProvider]).length)
      // 'microsoft.resources' -> '2016-09-01'
      assert.equal(2, validator.cache[expectedProvider][expectedApiVersion].get.length)
      assert.equal(1, validator.cache[expectedProvider][expectedApiVersion].delete.length)
      assert.equal(3, validator.cache[expectedProvider][expectedApiVersion].post.length)
      assert.equal(1, validator.cache[expectedProvider][expectedApiVersion].head.length)
      assert.equal(1, validator.cache[expectedProvider][expectedApiVersion].put.length)
      // 'microsoft.unknown' -> 'unknown-api-version'
      assert.equal(
        4,
        validator
          .cache[Constants.unknownResourceProvider][Constants.unknownApiVersion].post.length)
      assert.equal(
        11,
        validator
          .cache[Constants.unknownResourceProvider][Constants.unknownApiVersion].get.length)
      assert.equal(
        3,
        validator
          .cache[Constants.unknownResourceProvider][Constants.unknownApiVersion].head.length)
      assert.equal(
        5,
        validator
          .cache[Constants.unknownResourceProvider][Constants.unknownApiVersion].put.length)
      assert.equal(
        5,
        validator
          .cache[Constants.unknownResourceProvider][Constants.unknownApiVersion].delete.length)
      assert.equal(
        1,
        validator
          .cache[Constants.unknownResourceProvider][Constants.unknownApiVersion].patch.length)
    })
    it("should initialize for all swaggers", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/"
      }
      const validator = new LiveValidator(options)
      await validator.initialize()
      assert.equal(6, Object.keys(validator.cache).length)
      assert.equal(2, validator.cache["microsoft.resources"]["2016-09-01"].get.length)
      assert.equal(1, validator.cache["microsoft.resources"]["2016-09-01"].head.length)
      assert.equal(1, validator.cache["microsoft.media"]["2015-10-01"].patch.length)
      assert.equal(4, validator.cache["microsoft.media"]["2015-10-01"].post.length)
      assert.equal(2, validator.cache["microsoft.search"]["2015-02-28"].get.length)
      assert.equal(3, validator.cache["microsoft.search"]["2015-08-19"].get.length)
      assert.equal(1, validator.cache["microsoft.storage"]["2015-05-01-preview"].patch.length)
      assert.equal(4, validator.cache["microsoft.storage"]["2015-06-15"].get.length)
      assert.equal(3, validator.cache["microsoft.storage"]["2016-01-01"].post.length)
      assert.equal(4, validator.cache["microsoft.test"]["2016-01-01"].post.length)
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
      assert.equal(1, operations.length)
      assert.equal(
        "/subscriptions/{subscriptionId}/providers/Microsoft.Storage/storageAccounts",
        pathObject.path)

      // Operations to match is StorageAccounts_CheckNameAvailability
      operations = validator.getPotentialOperations(postRequestUrl, "PoSt").operations
      pathObject = operations[0].pathObject
      if (pathObject === undefined) {
        throw new Error("pathObject is undefined")
      }
      assert.equal(1, operations.length)
      assert.equal(
        "/subscriptions/{subscriptionId}/providers/Microsoft.Storage/checkNameAvailability",
        pathObject.path)

      // Operations to match is StorageAccounts_Delete
      operations = validator.getPotentialOperations(deleteRequestUrl, "delete").operations
      pathObject = operations[0].pathObject
      if (pathObject === undefined) {
        throw new Error("pathObject is undefined")
      }
      assert.equal(1, operations.length)
      assert.equal(
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
      assert.equal(0, operations.length)
      if (reason === undefined) {
        throw new Error("reason is undefined")
      }
      assert.equal(Constants.ErrorCodes.OperationNotFoundInCacheWithApi.name, reason.code)

      // Operations to match is StorageAccounts_CheckNameAvailability with provider "Hello.World"
      // [non cached provider]
      result = validator.getPotentialOperations(nonCachedProviderUrl, "PoSt")
      operations = result.operations
      reason = result.reason
      assert.equal(0, operations.length)
      if (reason === undefined) {
        throw new Error("reason is undefined")
      }
      assert.equal(Constants.ErrorCodes.OperationNotFoundInCacheWithProvider.name, reason.code)

      // Operations to match is StorageAccounts_Delete with verb "head" [non cached http verb]
      result = validator.getPotentialOperations(nonCachedVerbUrl, "head")
      operations = result.operations
      reason = result.reason
      assert.equal(0, operations.length)
      if (reason === undefined) {
        throw new Error("reason is undefined")
      }
      assert.equal(Constants.ErrorCodes.OperationNotFoundInCacheWithVerb.name, reason.code)

      // Operations to match is with path
      // "subscriptions/subscriptionId/providers/Microsoft.Storage/" +
      // "storageAccounts/storageAccounts/accountName/properties/"
      // [non cached path]
      result = validator.getPotentialOperations(nonCachedPath, "get")
      operations = result.operations
      reason = result.reason
      assert.equal(0, operations.length)
      if (reason === undefined) {
        throw new Error("reason is undefined")
      }
      assert.equal(Constants.ErrorCodes.OperationNotFoundInCache.name, reason.code)
    })
    it("it should create an implicit default response and find it", async () => {
      const options = {
        directory: "./test/liveValidation/swaggers/specification/scenarios",
        swaggerPathsPattern: "**/*.json",
        shouldModelImplicitDefaultResponse: true
      }
      /*
      const apiUrl =
        "https://management.azure.com/" +
        "subscriptions/subscriptionId/providers/Microsoft.Test/storageAccounts" +
        "?api-version=2016-01-01"
      */

      const validator = new LiveValidator(options)
      await validator.initialize()
      // Operations to match is StorageAccounts_List
      const operations = validator.cache["microsoft.test"]["2016-01-01"].post

      for (const operation of operations) {
        const responses = operation.responses as ResponsesObject
        if (responses.default === undefined) {
          throw new Error("responses.default === undefined")
        }
        if (responses.default.schema === undefined) {
          throw new Error("responses.default.schema === undefined")
        }
        if (responses.default.schema.properties === undefined) {
          throw new Error("responses.default.schema.properties === undefined")
        }
        assert.deepEqual(responses.default.schema.properties.error, utils.CloudError)
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
        /* tslint:disable-next-line */
        console.dir(validationResult, { depth: null, colors: true })
      })
    })
  })
})
