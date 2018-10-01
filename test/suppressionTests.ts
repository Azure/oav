// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { validateExamples } from "../lib/validate"
import * as assert from "assert"

describe("suppression", () => {
  it("suppress all", async () => {
    const result = await validateExamples(
      "./test/modelValidation/swaggers/specification/suppressions/test.json",
      undefined,
      {
        consoleLogLevel: "off"
      }
    )
    assert.strictEqual(result.length, 0)
  })
  it("suppress from", async () => {
    const result = await validateExamples(
      "./test/modelValidation/swaggers/specification/suppressions1/test.json",
      undefined,
      {
        consoleLogLevel: "off"
      }
    )
    assert.strictEqual(result.length, 0)
  })
  it("suppress where", async () => {
    const result = await validateExamples(
      "./test/modelValidation/swaggers/specification/suppressions2/test.json",
      undefined,
      {
        consoleLogLevel: "off"
      }
    )
    assert.strictEqual(result.length, 0)
  })
})
