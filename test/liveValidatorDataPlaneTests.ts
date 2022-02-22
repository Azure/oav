// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { LiveValidator } from "../lib/liveValidation/liveValidator";
import { TrafficValidator} from "../lib/swaggerValidator/trafficValidator";

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

    it("should load operationSpecMapper during initialization", async () => {
      const tableSwaggerFilePath = "co*/**/*.json";
      const specPath =
        "test/liveValidation/swaggers/specification/cosmos-db/data-plane/Microsoft.Tables/preview/2019-02-02/table.json";
      const options = {
        swaggerPathsPattern: [tableSwaggerFilePath],
        directory: "test/liveValidation/swaggers/specification",
      };
      const liveValidator = new LiveValidator(options);
      await liveValidator.initialize();
      expect(liveValidator.operationSpecMapper.size).toEqual(2);
      const operationidSet = liveValidator.operationSpecMapper.get(specPath);
      expect(operationidSet?.size).toEqual(14);
      expect(operationidSet?.has("Table_Query")).toBeTruthy();
    });

    it("should get coverage after validation", async () => {
      const specPath =
        "test/liveValidation/swaggers/specification/cosmos-db/data-plane/Microsoft.Tables/preview/2019-02-02/table.json";
      const trafficPath = "test/liveValidation/payloads/dataplane/deleteCosmosTable_input.json";
      const validator = new TrafficValidator(specPath, trafficPath);
      await validator.initialize();
      await validator.validate();
    });
  });
});
