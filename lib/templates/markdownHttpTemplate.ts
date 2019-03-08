// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { toArray } from "@ts-common/iterator"
import { keys } from "@ts-common/string-map"
import * as uuid from "uuid"

import { HttpTemplate, Request, Response, Responses } from "./httpTemplate"

export class MarkdownHttpTemplate extends HttpTemplate {
  public constructor(request: Request, responses: Responses) {
    super(request, responses)
  }

  public populate(): string {
    let template = ``
    template += this.populateRequest()
    template += this.populateCurl()
    if (this.responses) {
      if (this.responses.longrunning) {
        if (this.responses.longrunning.initialResponse) {
          template += this.populateResponse(
            this.responses.longrunning.initialResponse,
            "Initial Response"
          )
        }
        if (this.responses.longrunning.finalResponse) {
          template += this.populateResponse(
            this.responses.longrunning.finalResponse,
            "Final Response after polling is complete and successful"
          )
        }
      } else {
        if (this.responses.standard.finalResponse === undefined) {
          throw new Error("this.responses.standard.finalResponse === undefined")
        }
        template += this.populateResponse(this.responses.standard.finalResponse, "Response")
      }
    }
    return template
  }

  private getRequestHeaders(): string {
    let result = ``
    if (this.request.body) {
      result += `Content-Length: ${JSON.stringify(this.request.body).length}\n`
    }
    if (this.request.headers) {
      const headers = toArray(keys(this.request.headers))

      for (let i = 0; i < headers.length; i++) {
        const headerName = headers[i]
        result += `${headerName}: ${this.request.headers[headerName]}`
        if (i !== headers.length - 1) {
          result += `\n`
        }
      }
    }
    return result
  }

  private getResponseHeaders(response: Response): string {
    let result = ``
    if (response.body) {
      result += `Content-Length: ${JSON.stringify(response.body).length}\n`
    }
    let gotContentType = false
    if (response.headers) {
      const headers = toArray(keys(response.headers))
      for (let i = 0; i < headers.length; i++) {
        const headerName = headers[i]
        if (headerName.match(/^Content-Type$/gi) !== null) {
          gotContentType = true
        }
        result += `${headerName}: ${response.headers[headerName]}`
        if (i !== headers.length - 1) {
          result += `\n`
        }
      }
    }
    if (!gotContentType) {
      result += `Content-Type: application/json; charset=utf-8`
    }
    return result
  }

  private populateRequest(): string {
    const requestTemplate = `## Request

\`\`\`http
${this.request.method} ${this.request.url} HTTP/1.1
Authorization: Bearer <token>
${this.getRequestHeaders()}
host: ${this.getHost()}
Connection: close

${this.getRequestBody()}
\`\`\`\

`
    return requestTemplate
  }

  private populateResponse(response: Response, responseType: string): string {
    if (!responseType) {
      responseType = "Response"
    }
    const responseGuid = uuid.v4()
    const responseTemplate = `
## ${responseType}

#### StatusCode: ${response.statusCode}

\`\`\`http
HTTP 1.1 ${response.statusCode}
Cache-Control: no-cache
Pragma: no-cache
Expires: -1
x-ms-ratelimit-remaining-subscription-writes: 1199
x-ms-request-id: ${responseGuid}
x-ms-correlation-request-id: ${responseGuid}
x-ms-routing-request-id: WESTUS2:${new Date().toISOString().replace(/(\W)/gi, "")}:${responseGuid}
Strict-Transport-Security: max-age=31536000; includeSubDomains
${this.getResponseHeaders(response)}
Date: ${new Date().toUTCString()}
Connection: close

${this.getResponseBody(response)}
\`\`\`
`
    return responseTemplate
  }

  private populateCurl(): string {
    const method = this.request.method
    const url = this.request.url
    const requestHeaders = this.getCurlRequestHeaders()
    const requestBody = this.getCurlRequestBody()
    const template = `\n## Curl

\`\`\`bash
curl -X ${method} '${url}' \\\n-H 'authorization: bearer <token>' \\${requestHeaders}${requestBody}
\`\`\`
`
    return template
  }
}
