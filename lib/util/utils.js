// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';
var fs = require('fs'),
  util = require('util'),
  request = require('request');

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
 * @returns {object} Swagger - Parsed Swagger document in JSON format.
 */
exports.parseJson = function parseJson(specPath) {
  let result = null;
  if (!specPath || (specPath && typeof specPath.valueOf() !== 'string')) {
    let err = new Error('A (github) url or a local file path to the swagger spec is required and must be of type string.');
    return Promise.rject(err);
  }
  //url
  if (specPath.match(/^http.*/ig) !== null) {
    //If the spec path is a url starting with https://github then let us auto convert it to an https://raw.githubusercontent url.
    if (specPath.startsWith('https://github')) {
      specPath = specPath.replace(/^https:\/\/(github.com)(.*)blob\/(.*)/ig, 'https://raw.githubusercontent.com$2$3');
    }
    return exports.makeRequest({ url: specPath, errorOnNon200Response: true});
  } else {
    //local filepath
    try {
      result = JSON.parse(exports.stripBOM(fs.readFileSync(specPath, 'utf8')));
      return Promise.resolve(result);
    } catch (err) {
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
 * Provides current time in custom format that will be used in naming log files. Example:'20140820_151113'
 * @return {string} Current time in a custom string format
 */ 
exports.getTimeStamp = function getTimeStamp() {
  // We pad each value so that sorted directory listings show the files in chronological order
  function pad(number){
    if (number < 10)
    {
      return '0' + number;
    }

    return number;
  }

  var now = new Date();
  return pad(now.getFullYear()) 
    + pad(now.getMonth() + 1) 
    + pad(now.getDate())
    + "_" 
    + pad(now.getHours()) 
    + pad(now.getMinutes()) 
    + pad(now.getSeconds());
};

/*
 * Executes an array of promises sequentially
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

exports = module.exports;