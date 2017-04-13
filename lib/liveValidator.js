// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var util = require('util'),
  path = require('path'),
  _ = require('lodash'),
  glob = require('glob'),
  SpecValidator = require('./specValidator'),
  Constants = require('./util/constants'),
  log = require('./util/logging'),
  utils = require('./util/utils'),
  url = require("url");

/*
 * @class
 * Live Validator for Azure swagger APIs.
 */
class LiveValidator {
  /**
   * Constructs LiveValidator based on provided options.
   *
   * @param {object} options The configuration options.
   *
   * @param {array} [options.swaggerPaths] Array of swagger paths to be used for initializing Live Validator.
   * 
   * @param {string} [options.git.url] The url of the github repository. Defaults to "https://github.com/Azure/azure-rest-api-specs.git".
   * 
   * @param {string} [options.git.shouldClone] Specifies whether to clone the repository or not. Defaults to false.
   * 
   * @param {string} [options.directory] The directory where to clone github repository or from where to find swaggers. Defaults to "./repo".
   *
   * @returns {object} CacheBuilder Returns the configured CacheBuilder object.
   */
  constructor(options) {
    this.options = options;

    if (this.options === null || this.options === undefined) {
      this.options = {};
    }
    if (typeof this.options !== 'object') {
      throw new Error('options must be of type object');
    }
    if (this.options.swaggerPaths === null || this.options.swaggerPaths === undefined) {
      this.options.swaggerPaths = [];
    }
    if (!Array.isArray(this.options.swaggerPaths.valueOf())) {
      throw new Error(`options.swaggerPaths must be of type array instead of type "${this.options.swaggerPaths.valueOf()}".`);
    }
    if (this.options.git === null || this.options.git === undefined) {
      this.options.git = {
        "url": "https://github.com/Azure/azure-rest-api-specs.git",
        "shouldClone": false
      };
    }
    if (typeof this.options.git.valueOf() !== 'object') {
      throw new Error('options.git must be of type object.');
    }
    if (this.options.git.url === null || this.options.git.url === undefined) {
      this.options.git.url = "https://github.com/Azure/azure-rest-api-specs.git";
    }
    if (typeof this.options.git.url.valueOf() !== 'string') {
      throw new Error('options.git.url must be of type string.');
    }
    if (this.options.git.shouldClone === null || this.options.git.shouldClone === undefined) {
      this.options.git.shouldClone = false;
    }
    if (typeof this.options.git.shouldClone.valueOf() !== 'boolean') {
      throw new Error('options.git.shouldClone must be of type boolean.');
    }
    if (this.options.directory === null || this.options.directory === undefined) {
      this.options.directory = "./repo";
    }
    if (typeof this.options.directory.valueOf() !== 'string') {
      throw new Error('options.directory must be of type string.');
    }
    this.cache = {};
  }

  /*
   * Initializes the Live Validator.
   */
  initialize() {
    let self = this;

    // Clone github repository if required
    if (self.options.git.shouldClone) {
      utils.gitClone(self.options.git.url, self.options.directory);
    }

    // Construct array of swagger paths to be used for building a cache
    let swaggerPaths;
    if (self.options.swaggerPaths.length !== 0) {
      swaggerPaths = self.options.swaggerPaths;
      log.debug(`Using user provided swagger paths. Total paths: ${swaggerPaths.length}`);
    } else {
      swaggerPaths = glob.sync(path.join(self.options.directory, '/**/swagger/*.json'));
      log.debug(`Using swaggers found from ${self.options.directory} provided swagger paths. Total paths: ${swaggerPaths.length}`);
    }
    // console.log(swaggerPaths);
    // Create array of promise factories that builds up cache
    // Structure of the cache is 
    // {
    //   "provider1": {
    //     "api-version1": {
    //       "get": [
    //         "operation1",
    //         "operation2",
    //       ],
    //       "put": [
    //         "operation1",
    //         "operation2",
    //       ],
    //       ...
    //     },
    //     ...
    //   },
    //   ...
    // }
    let promiseFactories = swaggerPaths.map((swaggerPath) => {
      return () => {
        log.info(`Building cache from: "${swaggerPath}"`);
        let validator = new SpecValidator(swaggerPath);
        return validator.initialize().then(function (api) {
          let operations = api.getOperations();
          let apiVersion = api.info.version.toLowerCase();

          operations.forEach(function (operation) {
            let httpMethod = operation.method.toLowerCase();
            let provider = utils.getProvider(operation.pathObject.path);
            log.debug(`${apiVersion}, ${operation.operationId}, ${operation.pathObject.path}, ${httpMethod}`);

            if (!provider) {
              let title = api.info.title;

              // Whitelist lookups: Look up knownTitleToResourceProviders
              if (title && Constants.knownTitleToResourceProviders[title]) {
                provider = Constants.knownTitleToResourceProviders[title];
              }
              // Put the operation into 'Microsoft.Unknown' RPs
              else {
                provider = Constants.unknownResourceProvider;
              }
              log.warn(`Unable to find provider for path : "${operation.pathObject.path}". Bucketizing into provider: "${provider}"`);
            }
            provider = provider.toLowerCase();

            // TODO Look for operation those have api-version inside enums before
            // using apiVersion directly

            // Get all api-version for given provider or initialize it
            let apiVersions = self.cache[provider] || {};
            // Get methods for given apiVersion or initialize it
            let allMethods = apiVersions[apiVersion] || {};
            // Get specific http methods array for given verb or initialize it
            let httpMethods = allMethods[httpMethod] || [];

            // Builds the cache
            httpMethods.push(operation);
            allMethods[httpMethod] = httpMethods;
            apiVersions[apiVersion] = allMethods;
            self.cache[provider] = apiVersions;
          });

          return Promise.resolve(self.cache);
        }).catch(function (err) {
          log.warn(`Unable to initialize "${swaggerPath}" file from SpecValidator. Error: ${err}`);
          return Promise.reject(err);
        });
      }
    });

    return utils.executePromisesSequentially(promiseFactories).then(() => {
      log.info("Cache initialization complete.");
    });
  }

  /**
   * Gets list of potential sway operations objects for given url and method.
   *
   * @param {string} requestUrl The url for which to find potential operations.
   *
   * @param {string} requestMethod The http verb for the method to be used for lookup.
   *
   * @returns {Array} List of potential objects matching the url and method.
   */
  getPotentialOperations(requestUrl, requestMethod) {
    if (_.isEmpty(this.cache)) {
      let msg = `Please call "liveValidator.initialize()" before calling this method, so that cache is populated.`;
      throw new Error(msg);
    }

    if (requestUrl === null || requestUrl === undefined || typeof requestUrl.valueOf() !== 'string' ||
      !requestUrl.trim().length) {
      throw new Error('requestUrl is a required parameter of type string and it cannot be an empty string.');
    }

    if (requestMethod === null || requestMethod === undefined || typeof requestMethod.valueOf() !== 'string' ||
      !requestMethod.trim().length) {
      throw new Error('requestMethod is a required parameter of type string and it cannot be an empty string.');
    }

    let self = this;
    let potentialOperations = [];
    let parsedUrl = url.parse(requestUrl, true);
    let path = parsedUrl.pathname;
    requestMethod = requestMethod.toLowerCase();
    if (path === null || path === undefined) {
      log.warn(`Could not find path parameter from requestUrl: ${requestUrl}.`);
      return potentialOperations;
    }

    // Lower all the keys of query parameters before searching for `api-version`
    var queryObject = _.transform(parsedUrl.query, function (result, value, key) {
      result[key.toLowerCase()] = value;
    });
    let apiVersion = queryObject['api-version'];
    let provider = utils.getProvider(path);

    // Provider would be provider found from the path or Microsoft.Unknown
    provider = provider || Constants.unknownResourceProvider;
    provider = provider.toLowerCase();

    // Search using provider
    let allApiVersions = self.cache[provider];
    if (allApiVersions) {
      // Search using api-version found in the requestUrl
      if (apiVersion) {
        let allMethods = allApiVersions[apiVersion];
        if (allMethods) {
          let methodsWithHttpVerb = allMethods[requestMethod];
          // Search using requestMethod provided by user
          if (methodsWithHttpVerb) {
            // Find the best match using regex on path
            potentialOperations = self.getPotentialOperationsHelper(path, methodsWithHttpVerb);
          } else {
            log.warn(`Could not find any methods with verb "${requestMethod}" for api-version "${apiVersion}" and provider "${provider}" in the cache.`);
          }
        } else {
          log.warn(`Could not find api-version "${apiVersion}" for provider "${provider}" in the cache.`);
        }
      } else {
        log.warn(`Could not find api-version in requestUrl "${requestUrl}".`);
      }
    } else {
      // provider does not exist in cache
      log.warn(`Could not find provider "${provider}" in the cache.`);
    }

    return potentialOperations;
  }

  /**
   * Gets list of potential sway operations objects for given path and method.
   *
   * @param {string} requestPath The path of the url for which to find potential operations.
   *
   * @param {Array} operations The list of operations to search.
   *
   * @returns {Array} List of potential objects matching the requestPath.
   */
  getPotentialOperationsHelper(requestPath, operations) {
    if (requestPath === null || requestPath === undefined || typeof requestPath.valueOf() !== 'string' ||
      !requestPath.trim().length) {
      throw new Error('requestPath is a required parameter of type string and it cannot be an empty string.');
    }

    if (operations === null || operations === undefined || !Array.isArray(operations) ||
      !operations.length) {
      throw new Error('operations is a required parameter of type array and it cannot be an empty array.');
    }

    let potentialOperations = operations.filter(function (operation) {
      let pathMatch = operation.pathObject.regexp.exec(requestPath);
      return pathMatch === null ? false : true;
    });

    return potentialOperations;
  }
}

module.exports = LiveValidator;

// Used for testing
// var validator = new LiveValidator({ "directory": "./test/swaggers/arm-storage" });
// validator.initialize().then(function () {
//   validator.getPotentialOperations("https://management.azure.com/subscriptions/subscriptionId/providers/Microsoft.Storage/storageAccounts/accname?api-version=2015-06-15", 'delete');
// })
