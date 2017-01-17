// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

class ResponseWrapper {

  constructor(statusCode, body, headers, encoding) {
    this.statusCode = statusCode;
    this.body = body;
    this.headers = headers;
    this.encoding = encoding;
  }
}
module.exports = ResponseWrapper;