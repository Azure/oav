// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

var assert = require('assert'),
  path = require('path'),
  os = require('os'),
  glob = require('glob'),
  LiveValidator = require('../lib/validators/liveValidator.js'),
  Constants = require('../lib/util/constants');

const livePaths = glob.sync(path.join(__dirname, 'liveValidation/swaggers/**/live/*.json'));

describe('Live Validator', function () {
  describe('Initialization', function () {
    it('should initialize with defaults', function () {
      let options = {
        "swaggerPaths": [],
        "git": {
          "url": "https://github.com/Azure/azure-rest-api-specs.git",
          "shouldClone": false
        },
        "directory": path.resolve(os.homedir(), 'repo')
      };
      let validator = new LiveValidator();
      assert.deepEqual(validator.cache, {});
      assert.deepEqual(validator.options, options);
    });
    it('should initialize with user provided swaggerPaths', function () {
      let swaggerPaths = ["swaggerPath1", "swaggerPath2"];
      let options = {
        "swaggerPaths": swaggerPaths,
        "git": {
          "url": "https://github.com/Azure/azure-rest-api-specs.git",
          "shouldClone": false
        },
        "directory": path.resolve(os.homedir(), 'repo')
      };
      let validator = new LiveValidator({ "swaggerPaths": swaggerPaths });
      assert.deepEqual(validator.cache, {});
      assert.deepEqual(validator.options, options);
    });
    it('should initialize with user provided swaggerPaths & directory', function () {
      let swaggerPaths = ["swaggerPath1", "swaggerPath2"];
      let directory = "/Users/username/repos/"
      let options = {
        "swaggerPaths": swaggerPaths,
        "git": {
          "url": "https://github.com/Azure/azure-rest-api-specs.git",
          "shouldClone": false
        },
        "directory": directory
      };
      let validator = new LiveValidator({ "swaggerPaths": swaggerPaths, "directory": directory });
      assert.deepEqual(validator.cache, {});
      assert.deepEqual(validator.options, options);
    });
    it('should initialize with user provided partial git configuration', function () {
      let swaggerPaths = ["swaggerPath1", "swaggerPath2"];
      let directory = "/Users/username/repos/"
      let git = {
        "url": "https://github.com/vishrutshah/azure-rest-api-specs.git"
      }
      let options = {
        "swaggerPaths": swaggerPaths,
        "git": {
          "url": git.url,
          "shouldClone": false
        },
        "directory": directory
      };
      let validator = new LiveValidator({ "swaggerPaths": swaggerPaths, "directory": directory, "git": git });
      assert.deepEqual(validator.cache, {});
      assert.deepEqual(validator.options, options);
    });
    it('should initialize with user provided full git configuration', function () {
      let swaggerPaths = ["swaggerPath1", "swaggerPath2"];
      let directory = "/Users/username/repos/"
      let git = {
        "url": "https://github.com/vishrutshah/azure-rest-api-specs.git",
        "shouldClone": true
      }
      let options = {
        "swaggerPaths": swaggerPaths,
        "git": git,
        "directory": directory
      };
      let validator = new LiveValidator({ "swaggerPaths": swaggerPaths, "directory": directory, "git": git });
      assert.deepEqual(validator.cache, {});
      assert.deepEqual(validator.options, options);
    });
    it('should throw on invalid options types', function () {
      assert.throws(() => {
        new LiveValidator('string');
      }, /must be of type "object"/);
      assert.throws(() => {
        new LiveValidator({ "swaggerPaths": "should be array" });
      }, /must be of type "array"/);
      assert.throws(() => {
        new LiveValidator({ "git": 1 });
      }, /must be of type "object"/);
      assert.throws(() => {
        new LiveValidator({ "git": { "url": [] } });
      }, /must be of type "string"/);
      assert.throws(() => {
        new LiveValidator({ "git": { "url": "url", "shouldClone": "no" } });
      }, /must be of type "boolean"/);
    });
  });

  describe('Initialize cache', function () {
    it('should initialize for arm-mediaservices', function (done) {
      let expectedProvider = 'microsoft.media';
      let expectedApiVersion = '2015-10-01';
      let options = {
        "directory": "./test/liveValidation/swaggers/"
      };
      let validator = new LiveValidator(options);
      validator.initialize().then(function () {
        assert.equal(true, expectedProvider in validator.cache);
        assert.equal(6, Object.keys(validator.cache).length);
        assert.equal(true, expectedApiVersion in (validator.cache[expectedProvider]));
        assert.equal(1, Object.keys(validator.cache[expectedProvider]).length);
        assert.equal(2, validator.cache[expectedProvider][expectedApiVersion]['get'].length);
        assert.equal(1, validator.cache[expectedProvider][expectedApiVersion]['put'].length);
        assert.equal(1, validator.cache[expectedProvider][expectedApiVersion]['patch'].length);
        assert.equal(1, validator.cache[expectedProvider][expectedApiVersion]['delete'].length);
        assert.equal(4, validator.cache[expectedProvider][expectedApiVersion]['post'].length);
        done();
      }).catch((err) => {
        assert.ifError(err);
        done();
      }).catch(done);
    });
    it('should initialize for arm-resources', function (done) {
      let expectedProvider = 'microsoft.resources';
      let expectedApiVersion = '2016-09-01';
      let options = {
        "directory": "./test/liveValidation/swaggers/"
      };
      let validator = new LiveValidator(options);
      validator.initialize().then(function () {
        assert.equal(true, expectedProvider in validator.cache);
        assert.equal(6, Object.keys(validator.cache).length);
        assert.equal(true, expectedApiVersion in (validator.cache[expectedProvider]));
        assert.equal(1, Object.keys(validator.cache[expectedProvider]).length);
        // 'microsoft.resources' -> '2016-09-01'
        assert.equal(2, validator.cache[expectedProvider][expectedApiVersion]['get'].length);
        assert.equal(1, validator.cache[expectedProvider][expectedApiVersion]['delete'].length);
        assert.equal(3, validator.cache[expectedProvider][expectedApiVersion]['post'].length);
        assert.equal(1, validator.cache[expectedProvider][expectedApiVersion]['head'].length);
        assert.equal(1, validator.cache[expectedProvider][expectedApiVersion]['put'].length);
        // 'microsoft.unknown' -> 'unknown-api-version'
        assert.equal(4, validator.cache[Constants.unknownResourceProvider][Constants.unknownApiVersion]['post'].length);
        assert.equal(11, validator.cache[Constants.unknownResourceProvider][Constants.unknownApiVersion]['get'].length);
        assert.equal(3, validator.cache[Constants.unknownResourceProvider][Constants.unknownApiVersion]['head'].length);
        assert.equal(5, validator.cache[Constants.unknownResourceProvider][Constants.unknownApiVersion]['put'].length);
        assert.equal(5, validator.cache[Constants.unknownResourceProvider][Constants.unknownApiVersion]['delete'].length);
        assert.equal(1, validator.cache[Constants.unknownResourceProvider][Constants.unknownApiVersion]['patch'].length);
        done();
      }).catch((err) => {
        assert.ifError(err);
        done();
      }).catch(done);
    });
    it('should initialize for all swaggers', function (done) {
      let options = {
        "directory": "./test/liveValidation/swaggers/"
      };
      let validator = new LiveValidator(options);
      validator.initialize().then(function () {
        assert.equal(6, Object.keys(validator.cache).length);
        assert.equal(2, validator.cache['microsoft.resources']['2016-09-01']['get'].length);
        assert.equal(1, validator.cache['microsoft.resources']['2016-09-01']['head'].length);
        assert.equal(1, validator.cache['microsoft.media']['2015-10-01']['patch'].length);
        assert.equal(4, validator.cache['microsoft.media']['2015-10-01']['post'].length);
        assert.equal(2, validator.cache['microsoft.search']['2015-02-28']['get'].length);
        assert.equal(3, validator.cache['microsoft.search']['2015-08-19']['get'].length);
        assert.equal(1, validator.cache['microsoft.storage']['2015-05-01-preview']['patch'].length);
        assert.equal(4, validator.cache['microsoft.storage']['2015-06-15']['get'].length);
        assert.equal(3, validator.cache['microsoft.storage']['2016-01-01']['post'].length);
        assert.equal(4, validator.cache['microsoft.test']['2016-01-01']['post'].length);
        done();
      }).catch((err) => {
        assert.ifError(err);
        done();
      }).catch(done);
    });
  });

  describe('Initialize cache and search', function () {
    it('should return one matched operation for arm-storage', function (done) {
      let options = {
        "directory": "./test/liveValidation/swaggers/"
      };
      let listRequestUrl = "https://management.azure.com/subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts?api-version=2015-06-15";
      let postRequestUrl = "https://management.azure.com/subscriptions/subscriptionId/providers/Microsoft.Storage/checkNameAvailability?api-version=2015-06-15";
      let deleteRequestUrl = "https://management.azure.com/subscriptions/subscriptionId/resourceGroups/myRG/providers/Microsoft.Storage/storageAccounts/accname?api-version=2015-06-15";
      let validator = new LiveValidator(options);
      validator.initialize().then(function () {
        // Operations to match is StorageAccounts_List
        let operations = validator.getPotentialOperations(listRequestUrl, 'Get').operations;
        assert.equal(1, operations.length);
        assert.equal("/subscriptions/{subscriptionId}/providers/Microsoft.Storage/storageAccounts", operations[0].pathObject.path);

        // Operations to match is StorageAccounts_CheckNameAvailability
        operations = validator.getPotentialOperations(postRequestUrl, 'PoSt').operations;
        assert.equal(1, operations.length);
        assert.equal("/subscriptions/{subscriptionId}/providers/Microsoft.Storage/checkNameAvailability", operations[0].pathObject.path);

        // Operations to match is StorageAccounts_Delete
        operations = validator.getPotentialOperations(deleteRequestUrl, 'delete').operations;
        assert.equal(1, operations.length);
        assert.equal("/subscriptions/{subscriptionId}/resourceGroups/{resourceGroupName}/providers/Microsoft.Storage/storageAccounts/{accountName}", operations[0].pathObject.path);
        done();
      }).catch((err) => {
        assert.ifError(err);
        done();
      }).catch(done);
    });
    it('should return reason for not matched operations', function (done) {
      let options = {
        "directory": "./test/liveValidation/swaggers/"
      };
      let nonCachedApiUrl = "https://management.azure.com/subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts?api-version=2015-08-15";
      let nonCachedProviderUrl = "https://management.azure.com/subscriptions/subscriptionId/providers/Hello.World/checkNameAvailability?api-version=2015-06-15";
      let nonCachedVerbUrl = "https://management.azure.com/subscriptions/subscriptionId/resourceGroups/myRG/providers/Microsoft.Storage/storageAccounts/accname?api-version=2015-06-15";
      let nonCachedPath = "https://management.azure.com/subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts/accountName/properties?api-version=2015-06-15";
      let validator = new LiveValidator(options);
      validator.initialize().then(function () {
        // Operations to match is StorageAccounts_List with api-version 2015-08-15 [non cached api version]
        let result = validator.getPotentialOperations(nonCachedApiUrl, 'Get');
        let operations = result.operations;
        let reason = result.reason;
        assert.equal(0, operations.length);
        assert.equal(Constants.ErrorCodes.OperationNotFoundInCacheWithApi.name, reason.code);

        // Operations to match is StorageAccounts_CheckNameAvailability with provider "Hello.World" [non cached provider]
        result = validator.getPotentialOperations(nonCachedProviderUrl, 'PoSt');
        operations = result.operations;
        reason = result.reason;
        assert.equal(0, operations.length);
        assert.equal(Constants.ErrorCodes.OperationNotFoundInCacheWithProvider.name, reason.code);

        // Operations to match is StorageAccounts_Delete with verb "head" [non cached http verb]
        result = validator.getPotentialOperations(nonCachedVerbUrl, 'head');
        operations = result.operations;
        reason = result.reason;
        assert.equal(0, operations.length);
        assert.equal(Constants.ErrorCodes.OperationNotFoundInCacheWithVerb.name, reason.code);

        // Operations to match is with path "subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts/storageAccounts/accountName/properties/" [non cached path]
        result = validator.getPotentialOperations(nonCachedPath, 'get');
        operations = result.operations;
        reason = result.reason;
        assert.equal(0, operations.length);
        assert.equal(Constants.ErrorCodes.OperationNotFoundInCache.name, reason.code);
        done();
      }).catch((err) => {
        assert.ifError(err);
        done();
      }).catch(done);
    });
  });

  describe('Initialize cache and validate', function () {
    livePaths.forEach((livePath) => {
      it(`should validate request and response for "${livePath}"`, function (done) {
        let options = {
          "directory": "./test/liveValidation/swaggers/specification/storage"
        };
        let validator = new LiveValidator(options);
        validator.initialize().then(function () {
          let reqRes = require(livePath);
          let validationResult = validator.validateLiveRequestResponse(reqRes);
          console.dir(validationResult, { depth: null, colors: true });
          done();
        }).catch((err) => {
          assert.ifError(err);
          done();
        }).catch(done);
      });
    });
  });
});
