// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import assert from "assert";
import { FileLoader, FileLoaderOption } from "../../lib/swagger/fileLoader";

describe("FileLoader functions", () => {
  describe("isUnderFileRoot", () => {
    it("should check absolute paths correctly", () => {
      const options: FileLoaderOption = {
        fileRoot: `${__dirname}/Azure/oav/test/liveValidation/swaggers/specification`,
      };
      const loader = new FileLoader(options);
      const received = loader.isUnderFileRoot(`${__dirname}/Azure/oav/readme.md`);
      assert.strictEqual(received, false);
    });
  });
});
