// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

const assert = require('assert');
const validate = require('../lib/validate');

describe('Semantic validation', function () {
  it('should validate correctly when the spec contains an x-ms-parameterized-host', (done) => {
    let specPath = `${__dirname}/semanticValidation/specification/parameterizedhost/face.json`;
    validate.validateSpec(specPath, undefined, { consoleLogLevel: 'off' }).then((result) => {
      console.dir(result, { depth: null });
      assert(result.validityStatus === true, `swagger "${specPath}" contains model validation errors.`);
      console.log(result);
      done();
    }).catch((err) => {
      done(err);
    });
  });
});