// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as assert from "assert";

import { validateExamples } from "../lib/validate";

describe("validateExamples", () => {
  it("should throw Exception", async () => {
    try {
      await validateExamples("invalid.json", undefined, {
        consoleLogLevel: "off",
      });
      // the behavior may change in the future.
      assert.fail("validateExamples should throw().");
    } catch (e) {
      assert.notStrictEqual(e, undefined);
    }
  });
});
