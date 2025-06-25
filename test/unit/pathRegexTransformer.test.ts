jest.setTimeout(1000000); // Set the timeout in milliseconds

import { buildPathRegex } from "../../lib/transform/pathRegexTransformer";
import { PathParameter } from "../../lib/swagger/swaggerTypes";
describe("PathRegexTransformer tests", () => {
  it("A basic test", async () => {
    buildPathRegex("", "", "", new Map<string, PathParameter>());
  });
});
