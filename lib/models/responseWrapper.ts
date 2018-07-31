// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/*
 * @class
 * A Response wrapper that encapsulates basic info that can be validated for an HTTP(s) response.
 */
export class ResponseWrapper {
  /*
   * @constructor
   * Initializes an instance of the ResponseWrapper class.
   *
   * @param {number|string} statusCode The response statusCode
   *
   * @param {Unknown} body The response body
   *
   * @param {object} headers The response headers
   *
   * @param {string} encoding The encoding of the body when the body is a Buffer
   *
   * @return {object} An instance of the ResponseWrapper class.
   */
  constructor(
    public statusCode: number|string,
    public body: unknown,
    public headers: unknown,
    public encoding?: string) {
  }
}
