// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

const assert = require('assert');
const validate = require('../lib/validate');

const specPath = `${__dirname}/modelValidation/swaggers/specification/scenarios/resource-manager/Microsoft.Test/2016-01-01/test.json`;
describe('Model Validation', function () {
  it('should pass when path parameter has forward slashes', function (done) {
    let operationIds = "StorageAccounts_pathParameterWithForwardSlashes";
    validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'off' }).then((result) => {
      assert(result.validityStatus === true, `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`);
      console.log(result);
      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('should pass for paths in x-ms-paths with question mark', function (done) {
    let operationIds = "StorageAccounts_pathParameterWithQuestionMark";
    validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'off' }).then((result) => {
      assert(result.validityStatus === true, `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`);
      console.log(result);
      done();
    }).catch((err) => {
      done(err);
    });
  });

  it('should fail for paths with path parameter value resulting in duplicate forward slashes', function (done) {
    let operationIds = "StorageAccounts_duplicateforwardslashes";
    validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'off' }).then((result) => {
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
    it('should pass for Activity_List', function (done) {
      let specPath = `${__dirname}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`;
      let operationIds = "Activity_List";
      validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'off' }).then((result) => {
        assert(result.validityStatus === true, `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`);
        console.log(result);
        done();
      }).catch((err) => {
        done(err);
      });
    });

    it('should pass for Activity_Dictionary', function (done) {
      let specPath = `${__dirname}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`;
      let operationIds = "Activity_Dictionary";
      validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'off' }).then((result) => {
        assert(result.validityStatus === true, `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`);
        console.log(result);
        done();
      }).catch((err) => {
        done(err);
      });
    });

    it('should pass for CircularAnimal_List', function (done) {
      let specPath = `${__dirname}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`;
      let operationIds = "CircularAnimal_List";
      validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'off' }).then((result) => {
        assert(result.validityStatus === true, `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`);
        console.log(result);
        done();
      }).catch((err) => {
        done(err);
      });
    });

    it('should fail for CircularAnimal_IncorrectSibling_List', function (done) {
      let specPath = `${__dirname}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`;
      let operationIds = "CircularAnimal_IncorrectSibling_List";
      validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'off' }).then((result) => {
        assert(result.validityStatus === false, `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`);
        let responseError = result.operations['CircularAnimal_IncorrectSibling_List']
        ['x-ms-examples']['scenarios']['Tests ploymorphic circular array, dictionary of animals with incorrect sibling (negative)']['responses']['200'];
        assert.equal(responseError.isValid, false);
        assert.equal(responseError.error.code, 'RESPONSE_VALIDATION_ERROR');
        assert.equal(responseError.error.innerErrors[0].errors[0].code, 'ONE_OF_MISSING');
        done();
      }).catch((err) => {
        done(err);
      });
    });

    it('should pass for Entities_Search', function (done) {
      let specPath = `${__dirname}/modelValidation/swaggers/specification/polymorphic/EntitySearch.json`;
      let operationIds = "Entities_Search";
      validate.validateExamples(specPath, operationIds, { consoleLogLevel: 'off' }).then((result) => {
        assert(result.validityStatus === true, `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`);
        console.log(result);
        done();
      }).catch((err) => {
        done(err);
      });
    });
  });

  describe('for parameters in formdata', function () {
    it('should validate correclty', (done) => {
      let specPath = `${__dirname}/modelValidation/swaggers/specification/formdata/spellCheck.json`;
      validate.validateExamples(specPath, undefined, { consoleLogLevel: 'off' }).then((result) => {
        assert(result.validityStatus === true, `swagger "${specPath}" contains model validation errors.`);
        console.log(result);
        done();
      }).catch((err) => {
        done(err);
      });
    });
  });
});