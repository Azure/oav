// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable:no-console max-line-length*/

import assert from "assert";
import * as validate from "../lib/validate";

const testPath = __dirname.replace("\\", "/");

describe("Semantic validation", () => {
  it("Debug an individual semantic validation.", async () => {
    const specPath = `${testPath}/modelValidation/swaggers/specification/anyOfNecessary/scvmm.json`;
    const result = await validate.validateExamples(specPath, undefined);

    assert(
      result.length == 0,
      `swagger "${specPath}" contains unexpected model validation errors.`
    );
  });
});
