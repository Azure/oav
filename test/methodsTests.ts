// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as assert from "assert"

import { methods } from "../lib/util/methods"

describe("Methods", () => {
  it("HTTP methods", () => {
    const httpMethods: string[] = [
      "get",
      "put",
      "post",
      "delete",
      "options",
      "head",
      "patch"
    ]
    for (const method of methods) {
      const r = httpMethods.find(v => v === method)
      assert.strictEqual(r, method)
    }
  })
})
