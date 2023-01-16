import * as path from "path";
import { TrafficValidator } from "../lib/swaggerValidator/trafficValidator";

describe("TrafficValidator", () => {
  it("validate data-plane traffic", async () => {
    const validator = new TrafficValidator(
      path.resolve(
        process.cwd(),
        "./test/liveValidation/swaggers/specification/cosmos-db/data-plane/Microsoft.Tables"
      ),
      path.resolve(process.cwd(), "./test/liveValidation/payloads/dataplane/")
    );
    await validator.initialize();
    const result = {} as any;
    result.validationIssues = await validator.validate();
    result.operationCoverage = validator.operationCoverageResult;
    expect(result).toMatchSnapshot();
  });
});
