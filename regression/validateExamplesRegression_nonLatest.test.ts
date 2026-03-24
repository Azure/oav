import { allSpecs } from "./specsFilter.js";
import { validateExamplesRegressionTest } from "./validateExamplesRegressionTest.js";

describe("validateExamples should not regress for file", () => {
  test.each(allSpecs)("'%s'", validateExamplesRegressionTest, 999999);
});
