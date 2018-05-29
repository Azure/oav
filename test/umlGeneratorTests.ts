import assert = require('assert')
import validate = require('../lib/validate')
import fs = require('fs')

const specPath = `${__dirname}/modelValidation/swaggers/specification/polymorphic/EntitySearch.json`

describe('Uml generator', () => {
  it('should generate class diagram correctly', (done) => {
    const svgFile = `${__dirname}/diagram/EntitySearch.svg`
    if (fs.existsSync(svgFile)) fs.unlinkSync(svgFile)
    validate.generateUml(specPath, `${__dirname}/diagram`).then((res: any) => {
      assert.equal(fs.existsSync(svgFile), true)
      done()
    }).catch((err: any) => {
      done(err)
    })
  })
})