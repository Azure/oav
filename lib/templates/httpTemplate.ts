// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { URL } from "url";
import { mapEntries, MutableStringMap } from "@azure-tools/openapi-tools-common";
import * as msRest from "@azure/ms-rest-js";

export type Headers = MutableStringMap<string | undefined>;

export type Request = msRest.WebResource;

export interface Response {
  readonly body: unknown;
  readonly headers: Headers;
  readonly statusCode: string | number;
}

export interface Responses {
  longrunning: {
    initialResponse?: Response;
    finalResponse?: Response;
  };
  standard: {
    finalResponse?: Response;
  };
}

export class HttpTemplate {
  public constructor(public readonly request: Request, public readonly responses: Responses) {}

  protected getHost(): string | undefined {
    const requestUrl = this.request.url;
    return requestUrl
      ? new URL(requestUrl, "https://management.azure.com").host
      : "management.azure.com";
  }

  protected getCurlRequestHeaders(padding?: string): string {
    let result = ``;
    if (!padding) {
      padding = ``;
    }
    if (this.request.body) {
      result += `\n${padding}-H 'Content-Length: ${JSON.stringify(this.request.body).length}' \\`;
    }
    if (this.request.headers) {
      for (const [headerName, header] of mapEntries(this.request.headers)) {
        result += `\n${padding}-H '${headerName}: ${header}' \\`;
      }
    }
    return result;
  }

  protected getRequestBody(): string {
    return this.request && this.request.body !== null && this.request.body !== undefined
      ? JSON.stringify(this.request.body)
      : "";
  }

  // The format for request body in Curl has been inspired from the following links:
  // - https://stackoverflow.com/questions/34847981/curl-with-multiline-of-json
  // - https://ok-b.org/t/34847981/curl-with-multiline-of-json
  protected getCurlRequestBody(padding?: string): string {
    if (!padding) {
      padding = ``;
    }
    if (this.request && this.request.body !== null && this.request.body !== undefined) {
      const part = JSON.stringify(this.request.body, null, 2).split(`\n`).join(`\n${padding}`);
      return `\n${padding}-d @- << EOF\n${part}\n${padding}EOF`;
    } else {
      return "";
    }
  }

  protected getResponseBody(response: Response): string {
    return response && response.body !== null && response.body !== undefined
      ? JSON.stringify(response.body)
      : "";
  }
}
