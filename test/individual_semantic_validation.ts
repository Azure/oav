// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable:no-console max-line-length*/

import assert from "assert";
import * as validate from "../lib/validate";

const testPath = __dirname.replace("\\", "/");

describe("Semantic validation", () => {
  it("a valid minimal swagger should pass semantic validation", async () => {
    const specPath = `${testPath}/modelValidation/swaggers/specification/anyOfNecessary/scvmm.json`;
    const result = await validate.validateSpec(specPath, undefined);
    assert(
      result.validityStatus === true,
      `swagger "${specPath}" contains semantic validation errors.`
    );
  });
});
