// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { LiveValidator } from "../lib/liveValidation/liveValidator";

describe("LiveValidator for data-plane", () => {
  describe("Initialization", () => {
    it("should initialize data-plane swagger without errors", async () => {
      const tableSwaggerFilePath =
        "cosmos-db/data-plane/Microsoft.Tables/preview/2019-02-02/table.json";

      const options = {
        swaggerPathsPattern: [tableSwaggerFilePath],
        directory: "./test/liveValidation/swaggers/specification",
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      expect(liveValidator.operationSearcher.cache.size).toEqual(1);
      expect(Array.from(liveValidator.operationSearcher.cache.keys())).toEqual([
        "microsoft.unknown",
      ]);
    });
  });
});
