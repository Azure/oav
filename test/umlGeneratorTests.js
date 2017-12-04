const assert = require('assert');
const validate = require('../lib/validate');
const fs = require('fs');
const specPath = `${__dirname}/modelValidation/swaggers/specification/polymorphic/EntitySearch.json`;

describe('Uml generator', () => {
  it('should generate class diagram correctly', (done) => {
    const svgFile = `${__dirname}/diagram/EntitySearch.svg`;
    if (fs.existsSync(svgFile)) fs.unlinkSync(svgFile);
    validate.generateUml(specPath, `${__dirname}/diagram`).then((res) => {
      assert.equal(fs.existsSync(svgFile), true);
      done();
    }).catch((err) => {
      done(err);
    });
  });
});