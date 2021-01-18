import * as assert from "assert";

import * as validate from "../lib/validate";

const specPath = `test/modelValidation/swaggers/specification/invalidExamples/cdn.json`;

describe("Invalid examples", () => {
  it("from CDN", async () => {
    const result = await validate.validateExamples(specPath, undefined, {
      consoleLogLevel: "off",
    });
    assert.strictEqual(
      result.length,
      2,
      `swagger "${specPath}" with operation should contain 2 model validation errors.`
    );
    if (result[0].details === undefined) {
      throw new Error("result[0].details === undefined");
    }
    assert.strictEqual(result[0].details.code, "RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE");
  });
});
