// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as assert from "assert"

import { validateExamples } from "../lib/validate"

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
  it("suppress where with errors", async () => {
    const result = await validateExamples(
      "./test/modelValidation/swaggers/specification/suppressions3/test.json",
      undefined,
      {
        consoleLogLevel: "off"
      }
    )
    assert.strictEqual(result.length, 1)
  })
  it("suppress request parameter", async () => {
    const result = await validateExamples(
      "./test/modelValidation/swaggers/specification/suppressionsForRequest/test.json",
      undefined,
      {
        consoleLogLevel: "off"
      }
    )
    assert.strictEqual(result.length, 0)
  })
  it("suppress where 2", async () => {
    const result = await validateExamples(
      "./test/modelValidation/swaggers/specification/suppressionsWhere2/test.json",
      undefined,
      {
        consoleLogLevel: "off"
      }
    )
    assert.strictEqual(result.length, 1)
    if (result[0].details === undefined) {
      throw new Error("result[0].details === undefined")
    }
    assert.strictEqual(result[0].details.message, "Additional properties not allowed: some")
  })
})
