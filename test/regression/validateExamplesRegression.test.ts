import glob = require("glob")
import * as path from "path"

const validate = require("../../lib/validate")

describe("@regression validateExamples should not regress for file", () => {
  const specPaths = glob
    .sync(path.join(__dirname, "azure-rest-api-specs/specification/**/*.json"), {
      ignore: ["azure-rest-api-specs/specification/**/examples/*"]
    })
    .map((file, index) => [file, index % 10000])

  test.each(specPaths)(
    "'%s' @%sbatch",
    async file => {
      try {
        const result = await validate.validateExamples(file, undefined, {
          pretty: true
        })
        expect(result).toMatchSnapshot("returned results")
      } catch (e) {
        expect(e).toMatchSnapshot("thrown exception")
      }
    },
    999999
  )
})
