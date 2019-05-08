import { allSpecs } from "./specsFilter"
import { validateExamplesRegressionTest } from "./validateExamplesRegressionTest"

describe("validateExamples should not regress for file", () => {
  test.each(allSpecs)("'%s'", validateExamplesRegressionTest, 999999)
})
