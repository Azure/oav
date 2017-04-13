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
    if (path === null || path === undefined) {
      log.warn(`Could not find path parameter from requestUrl: ${requestUrl}.`);
      return potentialOperations;
    }

    // TODO: Do we always have api-version in lower case?
    // Lower the keys and then find api-version
    let apiVersion = parsedUrl.query['api-version'];

    // 1. First find based on providers
    //    1.1 Find based on api-version
    //      1.1.1 Else we don't recognize this operation -- log
    //    1.2 Find based on method
    //      1.2.1 Else we don't recognize this operation -- log
    // 2 Didn't find provider at all - Microsoft.unknown
    //    2.1 Search for api-version
    //      2.1.1 Else look for "http method" all operations
    //    2.2 Search for method
    //      2.2.1 Else we don't recognize this operation -- log
    if (apiVersion === null || apiVersion === undefined) {
      log.warn(`Could not find api-version query parameter from requestUrl: ${requestUrl}.`);
      return potentialOperations;
    }
    apiVersion = apiVersion.toLowerCase();

    let provider = utils.getProvider(path);
    if (provider === null || provider === undefined || !provider.trim().length) {
      log.warn(`Could not find provider namespace from requestUrl: ${requestUrl}.`);
      return potentialOperations;
    }
    provider = provider.toLowerCase();
    requestMethod = requestMethod.toLowerCase();

    if (self.cache[apiVersion] === undefined ||
      self.cache[apiVersion][provider] === undefined ||
      self.cache[apiVersion][provider][requestMethod] === undefined) {
      log.warn(`Could not find cache entry for requestUrl: ${requestUrl} and method: ${requestMethod}.`);
      return potentialOperations;
    }

    let operations = self.cache[apiVersion][provider][requestMethod];

    potentialOperations = operations.filter(function (operation) {
      let pathMatch = operation.pathObject.regexp.exec(path);
      return pathMatch === null ? false : true;
    });

    return potentialOperations;
  }
}

module.exports = LiveValidator;

// Used for testing
// var validator = new LiveValidator({ "directory": "/Users/vishrut/repos/openapi-validation-tools/test/swaggers/arm-resources" });
// validator.initialize().then(function () {
//   console.log(validator.cache);
// })
