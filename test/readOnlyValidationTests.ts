import * as assert from "assert";

import * as validate from "../lib/validate";

const specPath = `test/modelValidation/swaggers/specification/validateReadOnly/cdn.json`;

describe("Read Only properties", () => {
  it("should throw the error with correct code and message", async () => {
    const result = await validate.validateExamples(specPath, "Profiles_Create", {
      consoleLogLevel: "off",
    });
    assert.strictEqual(
      result.length,
      1,
      `swagger "${specPath}" with operation should contain 1 model validation errors.`
    );
    assert.strictEqual(
      result[0].code === "READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST",
      true,
      `swagger "${specPath}" should throw an error with code READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST`
    );
    assert.strictEqual(
      result[0].message,
      'ReadOnly property "provisioningState" cannot be sent in the request'
    );
  });

  it("for a number value discriminator should throw 2 errors - readonly properties not allowed in request and invalid type", async () => {
    const result = await validate.validateExamples(specPath, "Profiles_Update", {
      consoleLogLevel: "off",
    });
    assert.strictEqual(
      result.length,
      2,
      `swagger "${specPath}" with operation should contain 2 model validation errors.`
    );
    assert.strictEqual(
      result[0].code === "INVALID_TYPE",
      true,
      `swagger "${specPath}" should throw an error with code READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST`
    );
    assert.strictEqual(
      result[1].code === "READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST",
      true,
      `swagger "${specPath}" should throw an error with code READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST`
    );
  });
});
