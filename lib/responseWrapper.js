// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

/*
 * @class
 * A Response wrapper that encapsulates basic info that can be validated for an HTTP(s) response.
 */ 
class ResponseWrapper {
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
  constructor(statusCode, body, headers, encoding) {
    this.statusCode = statusCode;
    this.body = body;
    this.headers = headers;
    this.encoding = encoding;
  }
}
module.exports = ResponseWrapper;