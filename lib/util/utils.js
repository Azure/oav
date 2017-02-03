// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';
var fs = require('fs'),
  util = require('util'),
  path = require('path'),
  jsonPointer = require('json-pointer'),
  log = require('./logging'),
  request = require('request');

/*
 * Caches the json docs that were successfully parsed by exports.parseJson(). This avoids, fetching them again.
 * key: docPath
 * value: parsed doc in JSON format
 */  
exports.docCache = {};


/*
 * Removes byte order marker. This catches EF BB BF (the UTF-8 BOM)
 * because the buffer-to-string conversion in `fs.readFile()`
 * translates it to FEFF, the UTF-16 BOM.
 */ 
exports.stripBOM = function stripBOM(content) {
  if (Buffer.isBuffer(content)) {
    content = content.toString();
  }
  if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
    content = content.slice(1);
  }
  return content;
};

/*
 * Provides a parsed JSON from the given file path or a url.
 *
 * @param {string} specPath - A local file path or a (github) url to the swagger spec. 
 * The method will auto convert a github url to rawgithub url.
 *
 * @returns {object} jsonDoc - Parsed document in JSON format.
 */
exports.parseJson = function parseJson(specPath) {
  let result = null;
  if (!specPath || (specPath && typeof specPath.valueOf() !== 'string')) {
    let err = new Error('A (github) url or a local file path to the swagger spec is required and must be of type string.');
    return Promise.reject(err);
  }
  if (exports.docCache[specPath]) {
    return Promise.resolve(exports.docCache[specPath]);
  }
  //url
  if (specPath.match(/^http.*/ig) !== null) {
    //If the spec path is a url starting with https://github then let us auto convert it to an https://raw.githubusercontent url.
    if (specPath.startsWith('https://github')) {
      specPath = specPath.replace(/^https:\/\/(github.com)(.*)blob\/(.*)/ig, 'https://raw.githubusercontent.com$2$3');
    }
    let res = exports.makeRequest({ url: specPath, errorOnNon200Response: true});
    exports.docCache[specPath] = res;
    return res;
  } else {
    //local filepath
    try {
      result = JSON.parse(exports.stripBOM(fs.readFileSync(specPath, 'utf8')));
      exports.docCache[specPath] = result;
      return Promise.resolve(result);
    } catch (err) {
      log.error(err);
      return Promise.reject(err);
    }
  }
};

/*
 * A utility function to help us acheive stuff in the same way as async/await but with yield statement and generator functions.
 * It waits till the task is over.
 * @param {function} A generator function as an input
 */ 
exports.run = function run(genfun) {
  // instantiate the generator object
  var gen = genfun();
  // This is the async loop pattern
  function next(err, answer) {
    var res;
    if (err) {
      // if err, throw it into the wormhole
      return gen.throw(err);
    } else {
      // if good value, send it
      res = gen.next(answer);
    }
    if (!res.done) {
      // if we are not at the end
      // we have an async request to
      // fulfill, we do this by calling 
      // `value` as a function
      // and passing it a callback
      // that receives err, answer
      // for which we'll just use `next()`
      res.value(next);
    }
  }
  // Kick off the async loop
  next();
};

/*
 * Makes a generic request. It is a wrapper on top of request.js library that provides a promise instead of a callback.
 * 
 * @param {object} options - The request options as described over here https://github.com/request/request#requestoptions-callback
 * 
 * @param {boolean} options.errorOnNon200Response If true will reject the promise with an error if the response statuscode is not 200.
 * 
 * @return {Promise} promise - A promise that resolves to the responseBody or rejects to an error.
 */ 
exports.makeRequest = function makeRequest(options) {

  var promise = new Promise(function (resolve, reject) {
    request(options, function (err, response, responseBody) {
      if (err) {
        return reject(err);
      }
      if (options.errorOnNon200Response && response.statusCode !== 200) {
        var msg = `StatusCode: "${response.statusCode}", ResponseBody: "${responseBody}."`;
        return reject(new Error(msg));
      }
      let res;
      try {
        res = typeof responseBody.valueOf() === 'string'? JSON.parse(exports.stripBOM(responseBody)) : responseBody;
      } catch (error) {
        let msg = `An error occurred while executing JSON.parse() on the responseBody. ${util.inspect(error, {depth: null})}.`
        let e = new Error(msg);
        return reject(e);
      }
       
      return resolve(res);
    });
  });
  return promise;
};

/*
 * Executes an array of promises sequentially. Inspiration of this method is here: 
 * https://pouchdb.com/2015/05/18/we-have-a-problem-with-promises.html. An awesome blog on promises!
 *
 * @param {Array} promiseFactories An array of promise factories(A function that return a promise)
 * 
 * @return A chain of resolved or rejected promises 
 */
exports.executePromisesSequentially = function executePromisesSequentially(promiseFactories) {
  let result = Promise.resolve();
  promiseFactories.forEach(function (promiseFactory) {
    result = result.then(promiseFactory);
  });
  return result;
};

/*
 * Generates a randomId
 *
 * @param {string} [prefix] A prefix to which the random numbers will be appended.
 * 
 * @param {object} [existingIds] An object of existingIds. The function will 
 * ensure that the randomId is not one of the existing ones.
 * 
 * @return {string} result A random string 
 */
exports.generateRandomId = function generateRandomId(prefix, existingIds) {
  let randomStr;
  while (true) {
    randomStr = Math.random().toString(36).substr(2, 12);
    if (prefix && typeof prefix.valueOf() === 'string') {
      randomStr = prefix + randomStr;
    }
    if (!exsitingIds || !(randomStr in existingIds)) {
      break;
    }
  }
  return randomStr;
};

/*
 * Parses a [inline|relative] [model|parameter] reference in the swagger spec. 
 * This method does not handle parsing paths "/subscriptions/{subscriptionId}/etc.".
 * 
 * @param {string} reference Reference to be parsed.
 * 
 * @return {object} result
 *         {string} [result.filePath] Filepath present in the reference. Examples are:
 *             - '../newtwork.json#/definitions/Resource' => '../network.json'
 *             - '../examples/nic_create.json' => '../examples/nic_create.json'
 *         {object} [result.localReference] Provides information about the local reference in the json document.
 *         {string} [result.localReference.value] The json reference value. Examples are:
 *           - '../newtwork.json#/definitions/Resource' => '#/definitions/Resource'
 *           - '#/parameters/SubscriptionId' => '#/parameters/SubscriptionId'
 *         {string} [result.localReference.accessorProperty] The json path expression that can be used by 
 *         eval() to access the desired object. Examples are:
 *           - '../newtwork.json#/definitions/Resource' => 'definitions.Resource'
 *           - '#/parameters/SubscriptionId' => 'parameters,SubscriptionId'
 */
exports.parseReferenceInSwagger = function parseReferenceInSwagger(reference) {
  if (!reference || (reference && reference.trim().length === 0)) {
    throw new Error('reference cannot be null or undefined and it must be a non-empty string.');
  }

  let result = {};
  if  (reference.includes('#')) {
    //local reference in the doc
    if (reference.startsWith('#/')) {
      result.localReference = {};
      result.localReference.value = reference;
      result.localReference.accessorProperty = reference.slice(2).replace('/', '.');
    } else {
      //filePath+localReference
      let segments = reference.split('#');
      result.filePath = segments[0];
      result.localReference = {};
      result.localReference.value = '#' + segments[1];
      result.localReference.accessorProperty = segments[1].slice(1).replace('/', '.');
    }
  } else {
    //we are assuming that the string is a relative filePath
    result.filePath = reference;
  }
  
  return result;
};

/*
 * Same as path.join(), however, it converts backward slashes to forward slashes.
 * This is required because path.join() joins the paths and converts all the 
 * forward slashes to backward slashes if executed on a windows system. This can 
 * be problematic while joining a url. For example:
 * path.join('https://github.com/Azure/openapi-validation-tools/blob/master/lib', '../examples/foo.json') returns
 * 'https:\\github.com\\Azure\\openapi-validation-tools\\blob\\master\\examples\\foo.json' instead of 
 * 'https://github.com/Azure/openapi-validation-tools/blob/master/examples/foo.json'
 * 
 * @param variable number of arguments and all the arguments must be of type string. Similar to the API 
 * provided by path.join() https://nodejs.org/dist/latest-v6.x/docs/api/path.html#path_path_join_paths
 * @return {string} resolved path
 */ 
exports.joinPath = function joinPath() {
  let finalPath = path.join.apply(path, arguments);
  finalPath = finalPath.replace(/\\/gi, '/');
  finalPath = finalPath.replace(/^(http|https):\/(.*)/gi, '$1://$2');
  return finalPath;
};

/*
 * Provides a parsed JSON from the given file path or a url. Same as exports.parseJson(). However,
 * this method accepts variable number of path segments as strings and joins them together. 
 * After joining the path, it internally calls exports.parseJson().
 *
 * @param variable number of arguments and all the arguments must be of type string. 
 *
 * @returns {object} jsonDoc - Parsed document in JSON format.
 */
exports.parseJsonWithPathFragments = function parseJsonWithPathFragments() {
  let specPath = exports.joinPath.apply(this, arguments);
  return exports.parseJson(specPath);
};

/*
 * Merges source object into the target object
 * @param {object} source The object that needs to be merged
 * 
 * @param {object} target The object to be merged into
 * 
 * @returns {object} target - Returns the merged target object.
 */ 
exports.mergeObjects = function mergeObjects(source, target) {
  Object.keys(source).forEach(function(key) { 
    target[key] = source[key];
  });
  return target;
}

/*
 * Gets the object from the given doc based on the provided json reference pointer.
 * It returns undefined if the location is not found in the doc.
 * @param {object} doc The source object.
 * 
 * @param {string} ptr The json reference pointer
 * 
 * @returns {any} result - Returns the value that the ptr points to, in the doc.
 */ 
exports.getObject = function getObject(doc, ptr) {
  let result;
  try {
    result = jsonPointer.get(doc, ptr);
  } catch (err) {
    log.error(err);
  }
  return result;
};

/*
 * Sets the given value at the location provided by the ptr in the given doc.
 * @param {object} doc The source object.
 * 
 * @param {string} ptr The json reference pointer.
 * 
 * @param {any} value The value that needs to be set at the 
 * location provided by the ptr in the doc.
 */ 
exports.setObject = function setObject(doc, ptr, value) {
  let result;
  try {
    result = jsonPointer.set(doc, ptr, value);
  } catch (err) {
    log.error(err);
  }
  return result;
};

/*
 * Removes the location pointed by the json pointer in the given doc.
 * @param {object} doc The source object.
 * 
 * @param {string} ptr The json reference pointer.
 */ 
exports.removeObject = function removeObject(doc, ptr) {
  let result;
  try {
    result = jsonPointer.remove(doc, ptr);
  } catch (err) {
    log.error(err);
  }
  return result;
};

exports = module.exports;