// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as url from "url"
import * as utils from "../util/utils"
import * as msRest from "ms-rest"

export interface Headers {
  readonly [name: string]: string
}

export type Request = msRest.WebResource

export interface Response {
  readonly body: unknown
  readonly headers: Headers
  readonly statusCode: string
}

export interface Responses {
  readonly longrunning: {
    readonly initialResponse: Response
    readonly finalResponse: Response
  }
  readonly standard: {
    readonly finalResponse: Response
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

  protected getCurlRequestHeaders(padding?: string): string {
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
    return this.request && this.request.body !== null && this.request.body !== undefined
      ? JSON.stringify(this.request.body)
      : ""
  }

  // The format for request body in Curl has been inspired from the following links:
  // - https://stackoverflow.com/questions/34847981/curl-with-multiline-of-json
  // - https://ok-b.org/t/34847981/curl-with-multiline-of-json
  protected getCurlRequestBody(padding?: string): string {
    if (!padding) { padding = `` }
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      const part = JSON.stringify(this.request.body, null, 2).split(`\n`).join(`\n${padding}`)
      return `\n${padding}-d @- << EOF\n${part}\n${padding}EOF`
    } else {
      return ""
    }
  }

  protected getResponseBody(response: Response): string {
    return response && response.body !== null && response.body !== undefined
      ? JSON.stringify(response.body)
      : ""
  }
}
