// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { validateExamples } from "../lib/validate"
import * as assert from "assert"

describe("suppression", () => {
  it("no readme", async () => {
    const result = await validateExamples(
      "./test/modelValidation/swaggers/specification/suppressions/datalake.json",
      undefined,
      {
        consoleLogLevel: "off"
      }
    )
    assert.strictEqual(result.length, 0)
  })
})
