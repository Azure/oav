import * as path from "path";
import { LiveValidator } from "../lib/liveValidation/liveValidator";
import { TrafficValidator } from "../lib/swaggerValidator/trafficValidator";

describe("TrafficValidator", () => {
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
    expect(Array.from(liveValidator.operationSearcher.cache.keys())).toEqual(["microsoft.unknown"]);
  });

  it("should load operationSpecMapper during initialization", async () => {
    let specPath =
      "test/liveValidation/swaggers/specification/cosmos-db/data-plane/Microsoft.Tables/preview/2019-02-02/table.json";
    let trafficPath = "test/liveValidation/payloads/dataplane/";
    const validator = new TrafficValidator(specPath, trafficPath);
    await validator.initialize();
    specPath = path.resolve(process.cwd(), specPath);
    const operationIdSet = validator.operationSpecMapper.get(specPath);
    expect(operationIdSet?.length).toEqual(14);
    expect(operationIdSet?.includes("Table_Query")).toBeTruthy();
  });

  it("should get coverage after validation", async () => {
    const specPath =
      "test/liveValidation/swaggers/specification/cosmos-db/data-plane/Microsoft.Tables";
    const trafficPath = "test/liveValidation/payloads/dataplane/";
    const keyPath = path.resolve(
      process.cwd(),
      "test/liveValidation/swaggers/specification/cosmos-db/data-plane/Microsoft.Tables/preview/2019-02-02/table.json"
    );
    const validator = new TrafficValidator(specPath, trafficPath);
    await validator.initialize();
    await validator.validate();

    expect(validator.operationCoverageResult.length).toEqual(1);
    for (let i of validator.operationCoverageResult) {
      if (i.spec === keyPath) {
        expect(i.coveredOperations).toEqual(2);
        expect(i.totalOperations).toEqual(14);
        expect(i.validationFailOperations).toEqual(1);
        expect(i.coverageRate).toEqual(2.0 / 14.0);
      }
    }
    expect(validator.operationUndefinedResult).toEqual(1);
  });

  it("validate data-plane traffic", async () => {
    const validator = new TrafficValidator(
      "test/liveValidation/swaggers/specification/cosmos-db/data-plane/Microsoft.Tables",
      "test/liveValidation/payloads/dataplane/"
    );
    await validator.initialize();
    const result = {} as any;
    result.validationIssues = await validator.validate();
    result.operationCoverage = validator.operationCoverageResult;

    delete result.operationCoverage[0].spec;
    for (let e of result.validationIssues) {
      delete e.specFilePath;
      delete e.payloadFilePath;
    }
    expect(result).toMatchSnapshot();
  });
});
