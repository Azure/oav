// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import url = require('url')
import * as utils from '../util/utils'
import { HttpTemplate } from './httpTemplate'
import uuid = require('uuid')

export class YamlHttpTemplate extends HttpTemplate {

  constructor(request: any, responses: any) {
    super(request, responses)
  }

  getRequestHeaders() {
    let result = ``
    if (this.request.body) {
      result += `  Content-Length: ${JSON.stringify(this.request.body).length}\n`
    }
    if (this.request.headers) {
      let headers = utils.getKeys(this.request.headers)

      for (let i = 0; i < headers.length; i++) {
        let headerName = headers[i]
        result += `  ${headerName}: ${this.request.headers[headerName]}`
        if (i !== headers.length - 1) {
          result += `\n`
        }
      }
    }
    return result
  }

  getResponseHeaders(response: any) {
    let result = ``
    if (response.body) {
      result += `    Content-Length: ${JSON.stringify(response.body).length}\n`
    }
    let gotContentType = false
    if (response.headers) {
      let headers = utils.getKeys(response.headers)
      for (let i = 0; i < headers.length; i++) {
        let headerName = headers[i]
        if (headerName.match(/^Content-Type$/ig) !== null) gotContentType = true
        result += `    ${headerName}: ${response.headers[headerName]}`
        if (i !== headers.length - 1) {
          result += `\n`
        }
      }
    }
    if (!gotContentType) {
      result += `    Content-Type: application/json; charset=utf-8`
    }
    return result
  }

  populateRequest() {
    let requestTemplate =
      `#Request
request: |
  ${this.request.method} ${this.request.url} HTTP/1.1
  Authorization: Bearer <token>
${this.getRequestHeaders()}
  host: ${this.getHost()}
  Connection: close

  ${this.getRequestBody()}
`
    return requestTemplate
  }

  populateResponse(response: any, responseType: any) {
    if (!responseType) responseType = 'Response'
    let responseGuid = uuid.v4()
    let responseTemplate = `
#${responseType}
response:
  #${response.statusCode}
  ${response.statusCode}: |
    HTTP 1.1 ${response.statusCode}
    Cache-Control: no-cache
    Pragma: no-cache
    Expires: -1
    x-ms-ratelimit-remaining-subscription-writes: 1199
    x-ms-request-id: ${responseGuid}
    x-ms-correlation-request-id: ${responseGuid}
    x-ms-routing-request-id: WESTUS2:${new Date().toISOString().replace(/(\W)/ig, '')}:${responseGuid}
    Strict-Transport-Security: max-age=31536000; includeSubDomains
${this.getResponseHeaders(response)}
    Date: ${new Date().toUTCString()}
    Connection: close

    ${this.getResponseBody(response)}
`
    return responseTemplate
  }

  populateCurl() {
    let padding = `  `
    let template =
      `\n#Curl
curl: |
  curl -X ${this.request.method} '${this.request.url}' \\\n  -H 'authorization: bearer <token>' \\${this.getCurlRequestHeaders(padding)}${this.getCurlRequestBody(padding)}
`
    return template
  }

  populate() {
    let template = ``
    template += this.populateRequest()
    template += this.populateCurl()
    if (this.responses) {
      if (this.responses.longrunning) {
        if (this.responses.longrunning.initialResponse) {
          template += this.populateResponse(this.responses.longrunning.initialResponse, 'Initial Response')
        }
        if (this.responses.longrunning.finalResponse) {
          template += this.populateResponse(
            this.responses.longrunning.finalResponse,
            'Final Response after polling is complete and successful')
        }
      } else {
        template += this.populateResponse(this.responses.standard.finalResponse, 'Response')
      }
    }
    return template
  }
}
