import { latestSpecsOnly } from "./specsFilter"
import { validateExamplesRegressionTest } from "./validateExamplesRegressionTest"

describe("validateExamples should not regress for file", () => {
  test.each(latestSpecsOnly)("'%s'", validateExamplesRegressionTest, 999999)
})
