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
    const result = await validator.validate();
    expect(result).toMatchSnapshot();
    const operationCoverageResult = validator.operationCoverageResult;
    expect(operationCoverageResult).toMatchSnapshot();
  });
});
