// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable:no-console max-line-length*/

import assert from "assert";
import * as validate from "../lib/validate";

const testPath = __dirname.replace("\\", "/");

describe("Semantic validation", () => {
  it("should validate mutable readonly properties without erroring", async() => {
    const specPath = `${testPath}/modelValidation/swaggers/specification/readonlyNotRequired/openapi.json`;
    const result = await validate.validateExamples(specPath, "Widgets_Create");

    assert.strictEqual(result.length, 0);
  });
});
