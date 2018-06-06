// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as url from "url"
import * as utils from "../util/utils"
import * as msRest from "ms-rest"

export interface Headers {
  [name: string]: string
}

export type Request = msRest.WebResource

export interface Response {
  body: any
  headers: Headers
}

export interface Responses {
  longrunning: {
    initialResponse: Response
    finalResponse: Response
  }
  standard: {
    finalResponse: Response
  }
}

export class HttpTemplate {

  constructor(public readonly request: Request, public readonly responses: Responses) {
  }

  protected getHost(): string|undefined {
    const requestUrl = this.request.url
    return requestUrl
      ? url.parse(requestUrl).host
      : "management.azure.com"
  }

  protected getCurlRequestHeaders(padding?: any): string {
    let result = ``
    if (!padding) { padding = `` }
    if (this.request.body) {
      result += `\n${padding}-H 'Content-Length: ${JSON.stringify(this.request.body).length}' \\`
    }
    if (this.request.headers) {
      const headers = utils.getKeys(this.request.headers)

      for (const headerName of headers) {
        result += `\n${padding}-H '${headerName}: ${this.request.headers[headerName]}' \\`
      }
    }
    return result
  }

  protected getRequestBody(): string {
    let body = ``
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      body = JSON.stringify(this.request.body)
    }
    return body
  }

  // The format for request body in Curl has been inspired from the following links:
  // - https://stackoverflow.com/questions/34847981/curl-with-multiline-of-json
  // - https://ok-b.org/t/34847981/curl-with-multiline-of-json
  protected getCurlRequestBody(padding?: string): string {
    let body = ``
    if (!padding) { padding = `` }
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      const part = JSON.stringify(this.request.body, null, 2).split(`\n`).join(`\n${padding}`)
      body = `\n${padding}-d @- << EOF\n${part}\n${padding}EOF`
    }
    return body
  }

  protected getResponseBody(response: Response): string {
    let body = ``
    if (response && response.body !== null && response.body !== undefined) {
      body = JSON.stringify(response.body)
    }
    return body
  }
}
