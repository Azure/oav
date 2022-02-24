// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { LiveValidator } from "../lib/liveValidation/liveValidator";
import { TrafficValidator} from "../lib/swaggerValidator/trafficValidator";
import * as path from "path";

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
      expect(operationidSet?.length).toEqual(14);
      expect(operationidSet?.includes("Table_Query")).toBeTruthy();
    });

    it("should get coverage after validation", async () => {
      let specPath =
        "test/liveValidation/swaggers/specification/";
      let trafficPath = "test/liveValidation/payloads/coveragetest/";
      specPath = path.resolve(process.cwd(), specPath);
      trafficPath = path.resolve(process.cwd(), trafficPath);
      let keyPath = path.resolve(process.cwd(), "test/liveValidation/swaggers/specification/apimanagement/resource-manager/Microsoft.ApiManagement/preview/2018-01-01/apimusers.json");
      const validator = new TrafficValidator(specPath, trafficPath);
      await validator.initialize();
      await validator.validate();
      expect(validator.coverageResult.size).toEqual(67);
      expect(validator.coverageResult.get(keyPath)).toEqual(2.0/11.0); 
      keyPath = path.resolve(process.cwd(), "test/liveValidation/swaggers/specification/cosmos-db/data-plane/Microsoft.Tables/preview/2019-02-02/table.json");
      expect(validator.coverageResult.get(keyPath)).toEqual(1.0/14.0);
    });
  });
});
