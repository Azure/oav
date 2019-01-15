// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { validateExamples } from "../lib/validate"
import * as assert from "assert"

describe("error info", () => {
  it("error info should contain url to file", async () => {
    try {
      const result = await validateExamples(
        "./test/modelValidation/swaggers/specification/errorInfo/apimusers.json",
        undefined,
        {
          consoleLogLevel: "off"
        }
      )
      assert.strictEqual(result.length, 2)
      const r = result[0].details as any
      assert.strictEqual(
        r.url,
        "./test/modelValidation/swaggers/specification/errorInfo/apimusers.json"
      )
    } catch (e) {
      assert.fail(e)
    }
  })
})
