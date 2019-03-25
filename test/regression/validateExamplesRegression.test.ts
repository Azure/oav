import glob = require("glob")
import md5File = require("md5-file")
import * as path from "path"

import * as validate from "../../lib/validate"

describe("@regression validateExamples should not regress for file", () => {
  const specPaths = glob
    .sync(path.join(__dirname, "azure-rest-api-specs/specification/**/*.json"), {
      ignore: ["azure-rest-api-specs/specification/**/examples/*"]
    })
    .slice(0, 5)

  test.each(specPaths)(
    "'%s'",
    async file => {
      try {
        const hash = await new Promise(resolve => md5File(file, resolve))
        expect(hash).toMatchSnapshot("input file hash")

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
