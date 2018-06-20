// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable:no-console */

import assert from "assert"
import * as validate from "../lib/validate"

const specPath =
  `${__dirname}/modelValidation/swaggers/specification/scenarios/resource-manager/` +
  `Microsoft.Test/2016-01-01/test.json`

describe("Model Validation", () => {
  describe("Path validation - ", () => {
    it("should pass when path parameter has forward slashes", async () => {
      const operationIds = "StorageAccounts_pathParameterWithForwardSlashes"
      const result = await validate.validateExamples(
        specPath, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath}" with operation "${operationIds}" ` +
          `contains model validation errors.`)
      console.log(result)
    })

    it("should pass for paths in x-ms-paths with question mark", async () => {
      const operationIds = "StorageAccounts_pathParameterWithQuestionMark"
      const result = await validate.validateExamples(
        specPath, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for paths with quotes", async () => {
      const operationIds = "Path_WithQuotes"
      const result = await validate.validateExamples(
        specPath, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it(
      "should fail for paths with path parameter value resulting in duplicate forward slashes",
      async () => {
        const operationIds = "StorageAccounts_duplicateforwardslashes"
        try {
          const result = await validate.validateExamples(
            specPath, operationIds, { consoleLogLevel: "off" })
          assert(
            result.validityStatus === false,
            `swagger "${specPath}" with operation "${operationIds}" contains passed incorrectly.`)
          console.log(result)
        } catch (err) {
          assert.equal(err.code, "REQUEST_VALIDATION_ERROR")
          assert.equal(err.innerErrors[0].code, "DOUBLE_FORWARD_SLASHES_IN_URL")
        }
      })
  })

  describe("Polymorphic models - ", () => {
    it("should pass for Activity_List", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`
      const operationIds = "Activity_List"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for Activity_Dictionary", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`
      const operationIds = "Activity_Dictionary"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for CircularAnimal_List", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`
      const operationIds = "CircularAnimal_List"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should fail for CircularAnimal_IncorrectSibling_List", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`
      const operationIds = "CircularAnimal_IncorrectSibling_List"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === false,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      const scenarios = result
        .operations
        .CircularAnimal_IncorrectSibling_List
        ["x-ms-examples"]
        .scenarios
      if (scenarios === undefined) {
        throw new Error("scenarios === undefined")
      }
      const responseError = scenarios
        ["Tests ploymorphic circular array, " +
          "dictionary of animals with incorrect sibling (negative)"]
        .responses
        ["200"]
      assert.equal(responseError.isValid, false)
      if (responseError.error === undefined) {
        throw new Error("no error")
      }
      assert.equal(responseError.error.code, "RESPONSE_VALIDATION_ERROR")
      if (responseError.error.innerErrors === undefined) {
        throw new Error("innerErrors is undefined")
      }
      const errors = responseError.error.innerErrors[0].errors
      if (errors === undefined) {
        throw new Error("innerErrors is undefined")
      }
      assert.equal(errors[0].code, "ONE_OF_MISSING")
    })

    it("should pass for Entities_Search", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/polymorphic/EntitySearch.json`
      const operationIds = "Entities_Search"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })
  })

  describe("for parameters in formdata", () => {
    it("should validate correctly", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/formdata/spellCheck.json`
      const result = await validate.validateExamples(
        specPath2, undefined, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true, `swagger "${specPath2}" contains model validation errors.`)
      console.log(result)
    })
  })

  describe("for parameters in x-ms-parameterized-host", () => {
    it("should validate correctly", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/parameterizedhost/face.json`
      const result = await validate.validateExamples(
        specPath2, undefined, { consoleLogLevel: "off" })
      console.dir(result, { depth: null })
      assert(
        result.validityStatus === true, `swagger "${specPath2}" contains model validation errors.`)
      console.log(result)
    })

    it("should validate the presence of parameters", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/parameterizedhost/searchservice.json`
      const result = await validate.validateExamples(
        specPath2, undefined, { consoleLogLevel: "off" })
      console.dir(result, { depth: null })
      assert(
        result.validityStatus === true, `swagger "${specPath2}" contains model validation errors.`)
      console.log(result)
    })
  })

  describe("Nullable models - ", () => {
    it("should pass for regularOperation_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "regularOperation_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for formatInDefinition_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "formatInDefinition_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for enumInResponse_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "enumInResponse_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for readOnlyProp_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "readOnlyProp_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for arrayInResponse_List", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "arrayInResponse_List"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for objectInResponse_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "objectInResponse_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for typeArrayInResponse_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "typeArrayInResponse_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for xnullableFalse_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "xnullableFalse_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for requiredProp_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "requiredProp_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for inlineResponse_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "inlineResponse_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for RefWithNullableAtTopLevelOperation_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "RefWithNullableAtTopLevelOperation_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for definitionWithReference_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "definitionWithReference_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for definitionWithReferenceNull_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "definitionWithReferenceNull_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for definitionWithReferenceNotNullableOperation_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "definitionWithReferenceNotNullableOperation_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })

    it("should pass for nullableTopLevel_Get", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "nullableTopLevel_Get"
      const result = await validate.validateExamples(
        specPath2, operationIds, { consoleLogLevel: "off" })
      assert(
        result.validityStatus === true,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`)
      console.log(result)
    })
  })

  describe("Content type - ", () => {
    it("should pass for consumes application/octet-stream", async () => {
      const specPath2 =
        `${__dirname}/modelValidation/swaggers/specification/contenttype/datalake.json`
      const result = await validate.validateExamples(
        specPath2, undefined, { consoleLogLevel: "off" })
      console.dir(result, { depth: null })
      assert(
        result.validityStatus === true, `swagger "${specPath2}" contains model validation errors.`)
      console.log(result)
    })
  })

  describe("Queries - ", () => {
    it("should pass for various query parameters", async () => {
      const specPath2 = `${__dirname}/modelValidation/swaggers/specification/query/test.json`
      const result = await validate.validateExamples(
        specPath2, undefined, { consoleLogLevel: "off" })
      console.dir(result, { depth: null })
      assert(
        result.validityStatus === true, `swagger "${specPath2}" contains model validation errors.`)
      console.log(result)
    })
  })

  describe("Headers - ", () => {
    it("should pass for various header parameters", async () => {
      const specPath2 = `${__dirname}/modelValidation/swaggers/specification/header/test.json`
      const result = await validate.validateExamples(
        specPath2, undefined, { consoleLogLevel: "off" })
      console.dir(result, { depth: null })
      assert(
        result.validityStatus === true, `swagger "${specPath2}" contains model validation errors.`)
      console.log(result)
    })
  })
})
