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
    assert.strictEqual(result[0].code, "RESPONSE_STATUS_CODE_NOT_IN_EXAMPLE");
  });
});
