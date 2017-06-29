// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';
const url = require('url'),
  uuid = require('uuid');

class HttpTemplate {

  constructor(request, responses) {
    this.request = request;
    this.responses = responses;
  }

  getHost() {
    let result = 'management.azure.com';
    if (this.request.url) {
      result = url.parse(this.request.url).host;
    }
    return result;
  }

  getCurlRequestHeaders(padding) {
    let result = ``;
    if (!padding) padding = ``;
    if (this.request.body) {
      result += `\n${padding}-H 'Content-Length: ${JSON.stringify(this.request.body).length}' \\`;
    }
    if (this.request.headers) {
      let headers = Object.keys(this.request.headers);

      for (let i = 0; i < headers.length; i++) {
        let headerName = headers[i];
        result += `\n${padding}-H '${headerName}: ${this.request.headers[headerName]}' \\`;
      }
    }
    return result;
  }

  getRequestBody() {
    let body = ``;
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      body = JSON.stringify(this.request.body);
    }
    return body;
  }

  //The format for request body in Curl has been inspired from the following links:
  // - https://stackoverflow.com/questions/34847981/curl-with-multiline-of-json
  // - https://ok-b.org/t/34847981/curl-with-multiline-of-json
  getCurlRequestBody(padding) {
    let body = ``;
    if (!padding) padding = ``;
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      body = `\n${padding}-d @- << EOF\n${padding}${JSON.stringify(this.request.body, null, 2).split(`\n`).join(`\n${padding}`)}\n${padding}EOF`;
    }
    return body;
  }

  getResponseBody(response) {
    let body = ``;
    if (response && response.body !== null && response.body !== undefined) {
      body = JSON.stringify(response.body);
    }
    return body;
  }
}

module.exports = HttpTemplate;