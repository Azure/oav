// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

/*
 * @class
 * A Response wrapper that encapsulates basic info that can be validated for an HTTP(s) response.
 */ 
class ValidationResponse {
  /*
   * @constructor
   * Initializes an instance of the ResponseWrapper class.
   * 
   * @param {number|string} statusCode The response statusCode
   * 
   * @param {any} body The response body
   * 
   * @param {object} headers The response headers
   * 
   * @param {string} encoding The encoding of the body when the body is a Buffer
   * 
   * @return {object} An instance of the ResponseWrapper class.
   */ 
  constructor(type, code, message, jsonref, jsonpath, id, validationCategory, providerNamespace, resourceType) {
    this.code = code;
    this.code = code;
    this.message = message;
    this.jsonref = jsonref;
    this.jsonpath = jsonpath;
    this.id = id;
    this.validationCategory = validationCategory;
    this.providerNamespace = providerNamespace;
    this.resourceType = resourceType;
  }

  serialize() {
    let result = {};
    for (let prop in this) {
      if (this[prop] !== null && this[prop] !== undefined) {
        if (prop === 'jsonpath')
        result['json-path'] = this[prop];
      }
    }
    return result;
  }
}

module.exports = ValidationResponse;