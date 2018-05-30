// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import assert from 'assert'
import * as validate from '../lib/validate'

describe('Semantic validation', function () {
  it('should validate correctly when the spec contains an x-ms-parameterized-host', (done) => {
    let specPath = `${__dirname}/semanticValidation/specification/parameterizedhost/face.json`;
    validate.validateSpec(specPath, undefined, { consoleLogLevel: 'off' }).then((result: any) => {
      console.dir(result, { depth: null });
      assert(result.validityStatus === true, `swagger "${specPath}" contains model validation errors.`);
      console.log(result);
      done();
    }).catch((err: any) => {
      done(err);
    });
  });

  it('should validate correctly when the spec does not contain a definitions section', (done) => {
    let specPath = `${__dirname}/semanticValidation/specification/definitions/definitions.json`;
    validate.validateSpec(specPath, undefined, { consoleLogLevel: 'off' }).then((result: any) => {
      console.dir(result, { depth: null });
      assert(result.validityStatus === true, `swagger "${specPath}" contains model validation errors.`);
      console.log(result);
      done();
    }).catch((err: any) => {
      done(err);
    });
  });
});