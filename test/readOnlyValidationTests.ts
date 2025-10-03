import * as validate from "../lib/validate";

const specPath = `test/modelValidation/swaggers/specification/validateReadOnly/cdn.json`;

describe("Read Only properties", () => {
  it("should throw the error with correct code and message", async () => {
    const result = await validate.validateExamples(specPath, "Profiles_Create", {
      consoleLogLevel: "off",
    });

    expect(result).toMatchObject([
      {
        code: "READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST",
        message: 'ReadOnly property "provisioningState" cannot be sent in the request',
      },
    ]);
  });

  it("for a number value discriminator should throw 2 errors - readonly properties not allowed in request and invalid type", async () => {
    const result = await validate.validateExamples(specPath, "Profiles_Update", {
      consoleLogLevel: "off",
    });

    expect(result).toMatchObject([
      { code: "INVALID_TYPE" },
      { code: "READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST" },
    ]);
  });
});
