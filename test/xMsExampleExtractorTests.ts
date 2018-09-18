import * as validate from "../lib/validate"
import assert from "assert"

describe("xMsExampleExtractor", () => {
  it("simple", async () => {
    const specPath = "./test/xMsExamplesExtractor/databox.json"
    const recordings = "./test/xMsExamplesExtractor/SessionRecords"
    const result = await validate.extractXMsExamples(specPath, recordings, {})
    assert.deepStrictEqual(result, {})
  })
})
