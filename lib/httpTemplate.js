// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';
const url = require('url'),
  uuid = require('uuid');

class HttpTemplate {

  constructor(request, responses, emitYaml) {
    this.request = request;
    this.responses = responses;
    this.emitYaml = emitYaml || false;
  }

  getHost() {
    let result = 'management.azure.com';
    if (this.request.url) {
      result = url.parse(this.request.url).host;
    }
    return result;
  }

  getRequestHeaders() {
    let result = ``;
    let padding = this.emitYaml ? `  ` : ``;
    if (this.request.body) {
      result += `${padding}Content-Length: ${JSON.stringify(this.request.body).length}\n`;
    }
    if (this.request.headers) {
      let headers = Object.keys(this.request.headers);

      for (let i = 0; i < headers.length; i++) {
        let headerName = headers[i];
        result += `${padding}${headerName}: ${this.request.headers[headerName]}`;
        if (i !== headers.length - 1) {
          result += `\n`;
        }
      }
    }
    return result;
  }

  getCurlRequestHeaders() {
    let result = ``;
    let padding = this.emitYaml ? `  ` : ``;
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
  getCurlRequestBody() {
    let body = ``;
    let padding = this.emitYaml ? `  ` : ``;
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      body = `\n${padding}-d @- << EOF\n${padding}${JSON.stringify(this.request.body, null, 2).split(`\n`).join(`\n${padding}`)}\n${padding}EOF`;
    }
    return body;
  }

  getResponseHeaders(response) {
    let result = ``;
    let padding = this.emitYaml ? `    ` : ``;
    if (response.body) {
      result += `${padding}Content-Length: ${JSON.stringify(response.body).length}\n`;
    }
    let gotContentType = false;
    if (response.headers) {
      let headers = Object.keys(response.headers);
      for (let i = 0; i < headers.length; i++) {
        let headerName = headers[i];
        if (headerName.match(/^Content-Type$/ig) !== null) gotContentType = true;
        result += `${padding}${headerName}: ${response.headers[headerName]}`;
        if (i !== headers.length - 1) {
          result += `\n`;
        }
      }
    }
    if (!gotContentType) {
      result += `${padding}Content-Type: application/json; charset=utf-8`
    }
    return result;
  }

  getResponseBody(response) {
    let body = ``;
    if (response && response.body !== null && response.body !== undefined) {
      body = JSON.stringify(response.body);
    }
    return body;
  }

  populateRequest() {
    let requestTemplate = ``;
    let requestTemplateMD =
      `## Request

\`\`\`http
${this.request.method} ${this.request.url} HTTP/1.1
Authorization: Bearer <token>
${this.getRequestHeaders()}
host: ${this.getHost()}
Connection: close

${this.getRequestBody()}
\`\`\`\

`;


    let requestTemplateYAML =
      `#Request
request: |
  ${this.request.method} ${this.request.url} HTTP/1.1
  Authorization: Bearer <token>
${this.getRequestHeaders()}
  host: ${this.getHost()}
  Connection: close

  ${this.getRequestBody()}
`;

    requestTemplate = this.emitYaml ? requestTemplateYAML : requestTemplateMD;
    return requestTemplate;
  }

  populateResponse(response, responseType) {
    if (!responseType) responseType = 'Response';
    let responseGuid = uuid.v4();
    let responseTemplate = ``;

    let responseTemplateMD = `
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
x-ms-routing-request-id: WESTUS2:${new Date().toISOString().replace(/(\W)/ig, '')}:${responseGuid}
Strict-Transport-Security: max-age=31536000; includeSubDomains
${this.getResponseHeaders(response)}
Date: ${new Date().toUTCString()}
Connection: close

${this.getResponseBody(response)}
\`\`\`
`;


    let responseTemplateYAML = `
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
`;
    responseTemplate = this.emitYaml ? responseTemplateYAML : responseTemplateMD;
    return responseTemplate;
  }

  populateCurl() {
    let template = ``;
    let templateMD =
      `\n## Curl

\`\`\`bash
curl -X ${this.request.method} '${this.request.url}' \\\n-H 'authorization: bearer <token>' \\${this.getCurlRequestHeaders()}${this.getCurlRequestBody()}
\`\`\`
`;

    let templateYAML =
      `\n#Curl
curl: |
  curl -X ${this.request.method} '${this.request.url}' \\\n  -H 'authorization: bearer <token>' \\${this.getCurlRequestHeaders()}${this.getCurlRequestBody()}
`;
    template = this.emitYaml ? templateYAML : templateMD;
    return template;
  }

  populate() {
    let template = ``;
    template += this.populateRequest();
    template += this.populateCurl();
    if (this.responses) {
      if (this.responses.longrunning) {
        if (this.responses.longrunning.initialResponse) {
          template += this.populateResponse(this.responses.longrunning.initialResponse, 'Initial Response');
        }
        if (this.responses.longrunning.finalResponse) {
          template += this.populateResponse(this.responses.longrunning.finalResponse, 'Final Response after polling is complete and successful')
        }
      } else {
        template += this.populateResponse(this.responses.standard.finalResponse, 'Response');
      }
    }
    return template;
  }
}

module.exports = HttpTemplate;