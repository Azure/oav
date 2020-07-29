// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import assert from "assert";
import * as fs from "fs";

import * as validate from "../lib/validate";

const testPath = __dirname;

const specPath = `${testPath}/modelValidation/swaggers/specification/polymorphic/EntitySearch.json`;

describe("Uml generator", () => {
  it("should generate class diagram correctly", async () => {
    const svgFile = `${testPath}/diagram/EntitySearch.svg`;
    if (fs.existsSync(svgFile)) {
      fs.unlinkSync(svgFile);
    }
    await validate.generateUml(specPath, `${testPath}/diagram`);
    assert.strictEqual(fs.existsSync(svgFile), true);
  });
});
