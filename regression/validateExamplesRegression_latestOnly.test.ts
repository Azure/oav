import { latestSpecsOnly } from "./specsFilter.js";
import { validateExamplesRegressionTest } from "./validateExamplesRegressionTest.js";

describe("validateExamples should not regress for file", () => {
  test.each(latestSpecsOnly)("'%s'", validateExamplesRegressionTest, 999999);
});
