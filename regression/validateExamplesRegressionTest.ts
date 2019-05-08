import md5File = require("md5-file")

import * as validate from "../lib/validate"

export const validateExamplesRegressionTest = async (file: string) => {
  try {
    const hash = await new Promise(resolve =>
      md5File(file, (e, h) => {
        if (e) {
          throw e
        }
        resolve(h)
      })
    )
    expect(hash).toMatchSnapshot("input file hash")

    const result = await validate.validateExamples(file, undefined, {
      pretty: true
    })
    expect(result).toMatchSnapshot("returned results")
  } catch (e) {
    expect(e).toMatchSnapshot("thrown exception")
  }
}
