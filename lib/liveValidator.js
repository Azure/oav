// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var util = require('util'),
  path = require('path'),
  _ = require('lodash'),
  glob = require('glob'),
  SpecValidator = require('./specValidator'),
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
   * @param {string} [options.url] The url of the github repository. Defaults to "https://github.com/Azure/azure-rest-api-specs.git".
   * 
   * @param {string} [options.directory] The directory where to clone github repository. Defaults to "repo/.".
   *
   * @returns {object} CacheBuilder Returns the configured CacheBuilder object.
   */
  constructor(options) {
    this.cache = {};
    this.options = options;
    if (!this.options.url) {
      this.options.url = "https://github.com/Azure/azure-rest-api-specs.git";
    }
    if (!this.options.directory) {
      this.options.directory = "repo/.";
    }
  }

  /*
   * Initializes the Live Validator.
   */
  initialize() {
    let self = this;

    // Clone github repository
    utils.gitClone(self.options.url, self.options.directory);

    // Construct array of swagger paths to be used for building a cache
    this.swaggerPaths = glob.sync(path.join(self.options.directory, '/**/swagger/*.json'));

    // Used for quick debugging
    // this.swaggerPaths = ["/Users/vishrut/repos/azure-rest-api-specs/arm-authorization/2015-07-01/swagger/authorization.json"];

    // Create array of promise factories that builds up cache
    // Structure of the cache is 
    // {
    //   "api-version": {
    //     "provider1": {
    //       "GetMethod": [
    //         "operation1",
    //         "operation2",
    //       ],
    //       "PutMethod": [
    //         "operation1",
    //         "operation2",
    //       ],
    //       ...
    //     },
    //     ...
    //   },
    //   ...
    // }
    let promiseFactories = self.swaggerPaths.map((swaggerPath) => {
      return () => {
        log.info(`Building cache from "${swaggerPath}" file.`);
        let validator = new SpecValidator(swaggerPath);
        return validator.initialize().then(function (api) {
          let operations = api.getOperations();
          let apiVersion = api.info.version;
          log.info(`api-version: ${apiVersion}`);

          operations.forEach(function (operation) {
            let httpMethod = operation.method.toLocaleLowerCase();
            let provider = utils.getProvider(operation.pathObject.path);
            if (provider) {
              provider = provider.toLocaleLowerCase();
            } else {
              log.warn(`Unable to find provider for path : ${operation.pathObject.path}`);
              return;
            }

            // Get providers for given api version or initialize it
            let providers = self.cache[apiVersion] || {};
            // Get methods for given provider or initialize it
            let allMethods = providers[provider] || {};
            // Get specific http methods array for given verb or initialize it
            let httpMethods = allMethods[httpMethod] || [];

            // Builds the cache
            httpMethods.push(operation);
            allMethods[httpMethod] = httpMethods;
            providers[provider] = allMethods;
            self.cache[apiVersion] = providers;
          });
          return Promise.resolve(self.cache);
        }).catch(function (err) {
          log.warn(`Unable to initialize "${swaggerPath}" file.`);
          log.warn(err);
          return Promise.reject(err);
        });
      }
    });

    utils.executePromisesSequentially(promiseFactories).then(() => {
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
    let path = parsedUrl.pathname; // TODO: Do we need to take care of encoded url before matching?
    if (path === null || path === undefined) {
      log.warn(`Could not find path parameter from requestUrl: ${requestUrl}.`);
      return potentialOperations;
    }

    let apiVersion = parsedUrl.query['api-version']; // TODO: Do we always have api-version in lower case?
    if (apiVersion === null || apiVersion === undefined) {
      log.warn(`Could not find api-version query parameter from requestUrl: ${requestUrl}.`);
      return potentialOperations;
    }
    apiVersion = apiVersion.toLocaleLowerCase();

    let provider = utils.getProvider(path);
    if (provider === null || provider === undefined || !provider.trim().length) {
      log.warn(`Could not find provider namespace from requestUrl: ${requestUrl}.`);
      return potentialOperations;
    }
    provider = provider.toLocaleLowerCase();
    requestMethod = requestMethod.toLocaleLowerCase();

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
// var validator = new LiveValidator({});
// validator.initialize();