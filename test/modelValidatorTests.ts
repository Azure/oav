// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable:no-console max-line-length*/

import assert from "assert"

import * as validate from "../lib/validate"
import { ModelValidator } from "../lib/validators/modelValidator"

const testPath = __dirname

const specPath =
  `${testPath}/modelValidation/swaggers/specification/scenarios/resource-manager/` +
  `Microsoft.Test/2016-01-01/test.json`

describe("Model Validation", () => {
  describe("Path validation - ", () => {
    it("should pass when path parameter has forward slashes", async () => {
      const operationIds = "StorageAccounts_pathParameterWithForwardSlashes"
      const result = await validate.validateExamples(specPath, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath}" with operation "${operationIds}" ` +
          `contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass with pretty format", async () => {
      const operationIds = "StorageAccounts_pathParameterWithForwardSlashes"
      const result = await validate.validateExamples(specPath, operationIds, {
        consoleLogLevel: "off",
        pretty: true
      })
      assert(
        result.length === 0,
        `swagger "${specPath}" with operation "${operationIds}" ` +
          `contains model validation errors.`
      )
      // console.log(result)
    })

    it("should fail with collapsed similar array elements errors", async () => {
      const localSpecPath = `${testPath}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`
      const operationIds = "CircularAnimal_IncorrectSibling_List"
      const result = await validate.validateExamples(localSpecPath, operationIds, {
        consoleLogLevel: "off"
      })

      assert(
        result.length === 1,
        `swagger "${specPath} with operation "${operationIds}" should report only 1 error.`
      )

      if (result[0].details === undefined) {
        throw new Error("result[0].details === undefined")
      }
      if (result[0].details.similarPaths === undefined) {
        throw new Error("result[0].details.similarPaths === undefined")
      }
      if (result[0].details.similarJsonPaths === undefined) {
        throw new Error("result[0].details.similarJsonPaths === undefined")
      }
      assert(
        result[0].details.similarPaths.length === 1,
        `swagger "${specPath} with operation "${operationIds}" error should have a similar path.`
      )
      assert(
        result[0].details.similarJsonPaths.length === 1,
        `swagger "${specPath} with operation "${operationIds}" error should have a similar JSON path.`
      )
      // console.log(result)
    })

    it("should pass for paths in x-ms-paths with question mark", async () => {
      const operationIds = "StorageAccounts_pathParameterWithQuestionMark"
      const result = await validate.validateExamples(specPath, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for paths with quotes", async () => {
      const operationIds = "Path_WithQuotes"
      const result = await validate.validateExamples(specPath, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should fail for paths with path parameter value resulting in duplicate forward slashes", async () => {
      const operationIds = "StorageAccounts_duplicateforwardslashes"
      try {
        const result = await validate.validateExamples(specPath, operationIds, {
          consoleLogLevel: "off"
        })
        assert(
          result.length !== 0,
          `swagger "${specPath}" with operation "${operationIds}" contains passed incorrectly.`
        )
        // console.log(result)
      } catch (err) {
        assert.strictEqual(err.code, "REQUEST_VALIDATION_ERROR")
        assert.strictEqual(err.innerErrors[0].code, "DOUBLE_FORWARD_SLASHES_IN_URL")
      }
    })
  })

  describe("Polymorphic models - ", () => {
    it("should pass for Activity_List", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`
      const operationIds = "Activity_List"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for Activity_Dictionary", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`
      const operationIds = "Activity_Dictionary"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for CircularAnimal_List", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`
      const operationIds = "CircularAnimal_List"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should fail for CircularAnimal_IncorrectSibling_List", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`
      const operationIds = "CircularAnimal_IncorrectSibling_List"
      const validator = new ModelValidator(specPath2, null, {
        consoleLogLevel: "off"
      })
      await validator.initialize()
      validator.validateOperations(operationIds)
      const result = validator.specValidationResult
      assert(
        result.validityStatus === false,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      const operationResult = result.operations.CircularAnimal_IncorrectSibling_List
      if (operationResult === undefined) {
        throw new Error("operationResult === undefined")
      }
      const example = operationResult["x-ms-examples"]
      if (example === undefined) {
        throw new Error("example === undefined")
      }
      const scenarios = example.scenarios
      if (scenarios === undefined) {
        throw new Error("scenarios === undefined")
      }
      const scenario =
        scenarios[
          "Tests ploymorphic circular array, " +
            "dictionary of animals with incorrect sibling (negative)"
        ]
      if (scenario === undefined) {
        throw new Error("scenario === undefined")
      }
      if (scenario.responses === undefined) {
        throw new Error("scenario.responses === undefined")
      }
      const responseError = scenario.responses["200"]
      assert.strictEqual(responseError.isValid, false)
      if (responseError.error === undefined) {
        throw new Error("no error")
      }
      assert.strictEqual(responseError.error.code, "RESPONSE_VALIDATION_ERROR")
      if (responseError.error.innerErrors === undefined) {
        throw new Error("innerErrors is undefined")
      }
      const errors = responseError.error.innerErrors[0].errors
      if (errors === undefined) {
        throw new Error("innerErrors is undefined")
      }
      assert.strictEqual(errors[0].code, "ANY_OF_MISSING")
    })

    it("should pass for Entities_Search", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphic/EntitySearch.json`
      const operationIds = "Entities_Search"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })
  })

  describe("for parameters in formdata", () => {
    it("should validate correctly", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/formdata/spellCheck.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`)
      // console.log(result)
    })
  })

  describe("for parameters in x-ms-parameterized-host", () => {
    it("should validate correctly", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/parameterizedhost/face.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`)
      // console.log(result)
    })

    it("should validate the presence of parameters", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/parameterizedhost/searchservice.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`)
      // console.log(result)
    })
  })

  describe("Nullable models - ", () => {
    it("should pass for regularOperation_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "regularOperation_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for formatInDefinition_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "formatInDefinition_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for enumInResponse_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "enumInResponse_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for readOnlyProp_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "readOnlyProp_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for arrayInResponse_List", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "arrayInResponse_List"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for objectInResponse_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "objectInResponse_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for typeArrayInResponse_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "typeArrayInResponse_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for xnullableFalse_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "xnullableFalse_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for requiredProp_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "requiredProp_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for inlineResponse_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "inlineResponse_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for RefWithNullableAtTopLevelOperation_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "RefWithNullableAtTopLevelOperation_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for definitionWithReference_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "definitionWithReference_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for definitionWithReferenceNull_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "definitionWithReferenceNull_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for definitionWithReferenceNotNullableOperation_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "definitionWithReferenceNotNullableOperation_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })

    it("should pass for nullableTopLevel_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`
      const operationIds = "nullableTopLevel_Get"
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off"
      })
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      )
      // console.log(result)
    })
  })

  describe("Content type - ", () => {
    it("should pass for consumes application/octet-stream", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/contenttype/datalake.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`)
      // console.log(result)
    })
  })

  describe("Queries - ", () => {
    it("should pass for various query parameters", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/query/test.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`)
      // console.log(result)
    })
  })

  describe("Headers - ", () => {
    it("should pass for various header parameters", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/header/test.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`)
      // console.log(result)
    })
  })

  describe("No Default Response", () => {
    it("should fail on example with unrecognized status code", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/noDefault/test.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      // console.dir(result, { depth: null })
      assert(result.length === 1)
      assert.strictEqual(result[0].code, "RESPONSE_STATUS_CODE_NOT_IN_SPEC")
      // console.log(result)
    })
  })

  describe("Default doesn't cover non-error responses", () => {
    it("should fail on example with unrecognized status code", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/defaultIsErrorOnly/test.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      // console.dir(result, { depth: null })
      assert(result.length === 1)
      assert.strictEqual(result[0].code, "RESPONSE_STATUS_CODE_NOT_IN_SPEC")
      // console.log(result)
    })
  })

  describe("Should assume `type` is `object` for polymorphic types", () => {
    it("pass string instead of object", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphicNoType/noType.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      assert.strictEqual(result.length, 1)
      // it should report the real error `INVALID_TYPE` instead of the wrapper `ONE_OF_MISSING`
      assert.strictEqual(result[0].code, "INVALID_TYPE")
    })
  })

  describe("Should assume only one enum value for polymorphic discriminator", () => {
    it("x-ms-enum with modelAsString", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphicModelAsString/spec.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      assert.strictEqual(result.length, 0)
    })
  })

  describe("Discriminator is required property", () => {
    it("assumes the type to be the defined type in swagger if discriminator is missing", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphicRequired/spec.json`
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off"
      })
      assert.strictEqual(result.length, 0)
    })
  })
})
