// Licensed under the MIT License. See License.txt in the project root for license information.

import assert from "assert";
import { FileLoader, FileLoaderOption } from "../../lib/swagger/fileLoader";

describe("FileLoader functions", () => {
  describe("isFileUnderRoot", () => {
    it("should check absolute paths correctly", () => {
      const options: FileLoaderOption = {
        fileRoot:
          "/home/tianenx/github/azure/azure-rest-api-specs/specification",
      };
      const loader = new FileLoader(options);
      const received = loader.isUnderFileRoot("/home/tianenx/github/jacktn/oav/readme.md");
      assert.strictEqual(received, false);
    });
  });
});