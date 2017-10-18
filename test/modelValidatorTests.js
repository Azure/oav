// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

const assert = require('assert');
const validate = require('../lib/validate');

const specPath = `${__dirname}/swaggers/specification/scenarios/resource-manager/Microsoft.Test/2016-01-01/test.json`;
describe('Model Validation', function () {
  it('should pass when path parameter has forward slashes', function (done) {
    let operationIds = "StorageAccounts_pathParameterWithForwardSlashes";
    validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'error' }).then((result) => {
      assert(result.validityStatus === true, `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`);
      console.log(result);
      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('should pass for paths in x-ms-paths with question mark', function (done) {
    let operationIds = "StorageAccounts_pathParameterWithQuestionMark";
    validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'error' }).then((result) => {
      assert(result.validityStatus === true, `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`);
      console.log(result);
      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('should fail for paths with path parameter value resulting in duplicate forward slashes', function (done) {
    let operationIds = "StorageAccounts_duplicateforwardslashes";
    validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'error' }).then((result) => {
      assert(result.validityStatus === false, `swagger "${specPath}" with operation "${operationIds}" contains passed incorrectly.`);
      console.log(result);
      done();
    }).catch((err) => {
      try {
        assert.equal(err.code, 'REQUEST_VALIDATION_ERROR');
        assert.equal(err.innerErrors[0].code, 'DOUBLE_FORWARD_SLASHES_IN_URL');
        done();
      } catch (er) {
        done(er);
      }
    });
  });

  describe('Polymorphic models - ', function () {
    it('should pass for Activities', function (done) {
      let specPath = `${__dirname}/swaggers/specification/polymorphic/myswagger.json`;
      let operationIds = "Foo_List";
      validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'error' }).then((result) => {
        assert(result.validityStatus === true, `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`);
        console.log(result);
        done();
      }).catch((err) => {
        done(err);
      });
    });
  });
});