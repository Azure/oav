// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import url = require('url')
import uuid = require('uuid')
import utils = require('../util/utils')

class HttpTemplate {

  constructor(public request: any, public responses: any) {
  }

  getHost() {
    let result: string|undefined = 'management.azure.com'
    if (this.request.url) {
      result = url.parse(this.request.url).host
    }
    return result
  }

  getCurlRequestHeaders(padding?: any) {
    let result = ``
    if (!padding) padding = ``
    if (this.request.body) {
      result += `\n${padding}-H 'Content-Length: ${JSON.stringify(this.request.body).length}' \\`
    }
    if (this.request.headers) {
      let headers = utils.getKeys(this.request.headers)

      for (let i = 0; i < headers.length; i++) {
        let headerName = headers[i]
        result += `\n${padding}-H '${headerName}: ${this.request.headers[headerName]}' \\`
      }
    }
    return result
  }

  getRequestBody() {
    let body = ``
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      body = JSON.stringify(this.request.body)
    }
    return body
  }

  //The format for request body in Curl has been inspired from the following links:
  // - https://stackoverflow.com/questions/34847981/curl-with-multiline-of-json
  // - https://ok-b.org/t/34847981/curl-with-multiline-of-json
  getCurlRequestBody(padding?: any) {
    let body = ``
    if (!padding) padding = ``
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      body =
        `\n${padding}-d @- << EOF\n${padding}${JSON.stringify(this.request.body, null, 2).split(`\n`).join(`\n${padding}`)}\n${padding}EOF`
    }
    return body
  }

  getResponseBody(response: any) {
    let body = ``
    if (response && response.body !== null && response.body !== undefined) {
      body = JSON.stringify(response.body)
    }
    return body
  }
}

export = HttpTemplate