// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import assert from "assert"
import * as validate from "../lib/validate"
import * as fs from "fs"

const specPath = `${__dirname}/modelValidation/swaggers/specification/polymorphic/EntitySearch.json`

describe("Uml generator", () => {
  it("should generate class diagram correctly", (done) => {
    const svgFile = `${__dirname}/diagram/EntitySearch.svg`
    if (fs.existsSync(svgFile)) { fs.unlinkSync(svgFile) }
    validate.generateUml(specPath, `${__dirname}/diagram`).then((res: any) => {
      assert.equal(fs.existsSync(svgFile), true)
      done()
    }).catch((err: any) => {
      done(err)
    })
  })
})
