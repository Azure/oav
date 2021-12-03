// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable:no-console max-line-length*/

import assert from "assert";
import * as validate from "../lib/validate";

const testPath = __dirname;

const specPath =
  `${testPath}/modelValidation/swaggers/specification/scenarios/resource-manager/` +
  `Microsoft.Test/2016-01-01/test.json`;

describe("Model Validation", () => {
  describe("Path validation - ", () => {
    it("should pass when path parameter has forward slashes", async () => {
      const operationIds = "StorageAccounts_pathParameterWithForwardSlashes";
      const result = await validate.validateExamples(specPath, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath}" with operation "${operationIds}" ` +
          `contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass with pretty format", async () => {
      const operationIds = "StorageAccounts_pathParameterWithForwardSlashes";
      const result = await validate.validateExamples(specPath, operationIds, {
        consoleLogLevel: "off",
        pretty: true,
      });
      assert(
        result.length === 0,
        `swagger "${specPath}" with operation "${operationIds}" ` +
          `contains model validation errors.`
      );
      // console.log(result)
    });

    it("should fail with collapsed similar array elements errors", async () => {
      const localSpecPath = `${testPath}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`;
      const operationIds = "CircularAnimal_IncorrectSibling_List";
      const result = await validate.validateExamples(localSpecPath, operationIds, {
        consoleLogLevel: "off",
      });

      assert(
        result.length === 2,
        `swagger "${specPath} with operation "${operationIds}" should report two errors.`
      );
      assert(
        result[0].code === "OBJECT_ADDITIONAL_PROPERTIES",
        "error code should be OBJECT_ADDITIONAL_PROPERTIES."
      );
      assert(
        (result[0] as any).exampleJsonPath === "$responses.200.body.value[3].siblings[0].sanctuary",
        "error path in example is incorrect."
      );
      assert(
        result[1].code === "OBJECT_ADDITIONAL_PROPERTIES",
        "error code should be OBJECT_ADDITIONAL_PROPERTIES."
      );
      assert(
        (result[1] as any).exampleJsonPath === "$responses.200.body.value[4].siblings[0].sanctuary",
        "error path in example is incorrect."
      );
    });

    it("should pass for paths in x-ms-paths with question mark", async () => {
      const operationIds = "StorageAccounts_pathParameterWithQuestionMark";
      const result = await validate.validateExamples(specPath, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for paths with quotes", async () => {
      const operationIds = "Path_WithQuotes";
      const result = await validate.validateExamples(specPath, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should fail for paths with path parameter value resulting in duplicate forward slashes", async () => {
      const operationIds = "StorageAccounts_duplicateforwardslashes";
      try {
        const result = await validate.validateExamples(specPath, operationIds, {
          consoleLogLevel: "off",
        });
        assert(
          result.length === 1,
          `swagger "${specPath}" with operation "${operationIds}" should report one error.`
        );
        assert(
          result[0].code === "DOUBLE_FORWARD_SLASHES_IN_URL",
          "error code should be DOUBLE_FORWARD_SLASHES_IN_URL."
        );
        // console.log(`result: ${JSON.stringify(result)}`);
      } catch (err) {
        assert.strictEqual(err.code, "REQUEST_VALIDATION_ERROR");
        assert.strictEqual(err.innerErrors[0].code, "DOUBLE_FORWARD_SLASHES_IN_URL");
      }
    });
  });

  describe("Polymorphic models - ", () => {
    it("should pass for Activity_List", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`;
      const operationIds = "Activity_List";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for Activity_Dictionary", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`;
      const operationIds = "Activity_Dictionary";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for CircularAnimal_List", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphic/polymorphicSwagger.json`;
      const operationIds = "CircularAnimal_List";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for Entities_Search", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphic/EntitySearch.json`;
      const operationIds = "Entities_Search";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });
  });

  describe("for parameters in formdata", () => {
    it("should validate correctly", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/formdata/spellCheck.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`);
      // console.log(result)
    });
  });

  describe("for parameters in x-ms-parameterized-host", () => {
    it("should validate correctly", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/parameterizedhost/face.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`);
      // console.log(result)
    });

    it("should validate the presence of parameters", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/parameterizedhost/searchservice.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`);
      // console.log(result)
    });

    it("should pass for parameters values include url", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/parameterizedhost/searchindex.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`);
      // console.log(result)
    });

    it("should pass for parameters include pattern", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/parameterizedhost/searchindex2.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`);
    });

    it("should pass when useSchemePrefix does not declare explicitly", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/parameterizedhost/searchindex3.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`);
    });
  });

  describe("Nullable models - ", () => {
    it("should pass for regularOperation_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "regularOperation_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for formatInDefinition_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "formatInDefinition_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for enumInResponse_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "enumInResponse_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for readOnlyProp_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "readOnlyProp_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for arrayInResponse_List", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "arrayInResponse_List";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for objectInResponse_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "objectInResponse_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for typeArrayInResponse_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "typeArrayInResponse_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for xnullableFalse_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "xnullableFalse_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for requiredProp_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "requiredProp_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for inlineResponse_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "inlineResponse_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for RefWithNullableAtTopLevelOperation_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "RefWithNullableAtTopLevelOperation_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for definitionWithReference_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "definitionWithReference_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for definitionWithReferenceNull_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "definitionWithReferenceNull_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for definitionWithReferenceNotNullableOperation_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "definitionWithReferenceNotNullableOperation_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for nullableTopLevel_Get", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/invalid_type_test.json`;
      const operationIds = "nullableTopLevel_Get";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });

    it("should pass for nullable array types", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullableTypes/array_nullable.json`;
      const operationIds = "Models_Update";
      const result = await validate.validateExamples(specPath2, operationIds, {
        consoleLogLevel: "off",
      });
      assert(
        result.length === 0,
        `swagger "${specPath2}" with operation "${operationIds}" contains model validation errors.`
      );
      // console.log(result)
    });
  });

  describe("Content type - ", () => {
    it("should pass for consumes application/octet-stream", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/contenttype/datalake.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`);
      // console.log(result)
    });

    it("should fail when request/response doesn't have allowed content-type", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/invalidContentType/test.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "INVALID_CONTENT_TYPE");
      assert.strictEqual(
        result[0].message,
        "Invalid Content-Type (text/powershell).  These are supported: application/json"
      );
    });
  });

  describe("Queries - ", () => {
    it("should pass for various query parameters", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/query/test.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`);
      // console.log(result)
    });
  });

  describe("Headers - ", () => {
    it("should pass for various header parameters", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/header/test.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      // console.dir(result, { depth: null })
      assert(result.length === 0, `swagger "${specPath2}" contains model validation errors.`);
      // console.log(result)
    });
  });

  describe("No Default Response", () => {
    it("should fail on example with unrecognized status code", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/noDefault/test.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      // console.dir(result, { depth: null })
      assert(result.length === 1);
      assert.strictEqual(result[0].code, "RESPONSE_STATUS_CODE_NOT_IN_SPEC");
      // console.log(result)
    });
  });

  describe("No body in response if schema is defined for response", () => {
    it("should fail on example without body defined in response", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/noBodyInResponse/test.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      assert(result.length === 1);
      assert.strictEqual(result[0].code, "RESPONSE_BODY_NOT_IN_EXAMPLE");
    });
  });

  describe("Null body in response if schema is defined for response", () => {
    it("should pass on example if response schema has x-nullable equals true", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullBodyInResponse/test.json`;
      const opertionIds = "op_nullable";
      const result = await validate.validateExamples(specPath2, opertionIds, {
        consoleLogLevel: "off",
      });
      assert(result.length === 0);
    });
    it("should fail on example if response schema doesn't have x-nullable equals true", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/nullBodyInResponse/test.json`;
      const opertionIds = "op_notNullable";
      const result = await validate.validateExamples(specPath2, opertionIds, {
        consoleLogLevel: "off",
      });
      assert(result.length === 1);
      assert.strictEqual(result[0].code, "INVALID_TYPE");
      assert.strictEqual(result[0].message, "Expected type object but found type null");
    });
  });

  describe("Extra body in response even it's not defined in schema", () => {
    it("should fail on example when extra body defined in response", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/extraBodyInResponse/test.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      assert(result.length === 1);
      assert.strictEqual(result[0].code, "RESPONSE_SCHEMA_NOT_IN_SPEC");
    });
  });

  describe("Default doesn't cover non-error responses", () => {
    it("should fail on example with unrecognized status code", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/defaultIsErrorOnly/test.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      // console.dir(result, { depth: null })
      assert(result.length === 1);
      assert.strictEqual(result[0].code, "RESPONSE_STATUS_CODE_NOT_IN_SPEC");
      // console.log(result)
    });
  });

  describe("Should assume `type` is `object` for polymorphic types", () => {
    it("pass string instead of object", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphicNoType/noType.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "INVALID_TYPE");
    });
  });

  describe("Should assume only one enum value for polymorphic discriminator", () => {
    it("x-ms-enum with modelAsString", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphicModelAsString/spec.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      assert.strictEqual(result.length, 0);
    });
  });

  describe("Global parameter in request validation", () => {
    it("Validation should work against defined schema", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/globalParamsInRequest/test.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "OBJECT_MISSING_REQUIRED_PROPERTY");
    });
  });

  describe("Secret property in response validation", () => {
    it("Validation should report error when secret appears in response of non-Post operation", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/secretProperty/secretSwagger.json`;
      const operationId = "SecretUser_Get";
      const result = await validate.validateExamples(specPath2, operationId, {
        consoleLogLevel: "off",
      });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "SECRET_PROPERTY");
    });
    it("Validation should not report error when secret appears in response of post operation", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/secretProperty/secretSwagger.json`;
      const operationId = "SecretUser_Post";
      const result = await validate.validateExamples(specPath2, operationId, {
        consoleLogLevel: "off",
      });
      assert.strictEqual(result.length, 0);
    });
  });

  describe("Discriminator is required property", () => {
    it("report error when discriminator is missing", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphicRequired/spec.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "DISCRIMINATOR_VALUE_NOT_FOUND");
    });
  });

  describe("Base polymorphic model", () => {
    it("Should have origin enum values and base model name as discriminator values list", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/polymorphicBaseModelDiscriminator/spec.json`;
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
      assert.strictEqual(result.length, 0);
    });
  });
  describe("WithIn Reference", () => {
    it("should fail when validating a swagger with invalid reference", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/invalidReference/searchindex.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "UNRESOLVABLE_REFERENCE");
      assert.strictEqual(
        result[0].message,
        "Reference could not be resolved: #/definitions/SearchError1"
      );
    });
  });

  describe("should pass for validate generated 'uri' format string", () => {
    it("should pass when examples match the 'uri' format definition of swagger file", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/loadtestservice/loadtestservice.json`;
      const result = await validate.validateExamples(specPath2, "TestRun_StopTestRun");
      assert.strictEqual(result.length, 0);
    });

    it("should failed when examples doesn't match the 'uri' format definition of swagger file", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/loadtestservice/loadtestservice.json`;
      const result = await validate.validateExamples(specPath2, "TestRun_GetAppTestRunsSearch");
      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].code, "INVALID_FORMAT");
      assert.strictEqual(result[1].code, "INVALID_FORMAT");
      assert.strictEqual(result[2].code, "INVALID_FORMAT");
    });
  });

  describe("Enum matching validation", () => {
    it("should fail when enum value provided in example or in traffic payload doesn't match the case of an allowed value", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/enum/enumCaseMismatch/test.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "ENUM_CASE_MISMATCH");
      assert.strictEqual(result[0].message, "Enum does not match case for: none");
    });

    it("should fail when enum value provided in example or in traffic payload doesn't match an allowed value", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/enum/enumMismatch/test.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "ENUM_MISMATCH");
      assert.strictEqual(result[0].message, "No enum match for: null");
    });
  });

  describe("Long running operation response validation", () => {
    it("should fail when long running operation missing return some headers in header", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/LRO-response/LRO-responseHeader/test.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "LRO_RESPONSE_HEADER");
      assert.strictEqual(
        result[0].message,
        "Long running operation should return location or azure-AsyncOperation in header but not provided"
      );
    });

    it("should fail when long running operation return wrong response code", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/LRO-response/LRO-responseCode/test.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "LRO_RESPONSE_CODE");
      assert.strictEqual(
        result[0].message,
        "Respond to the initial request of a long running operation, Patch/Post call must return 201 or 202, Delete call must return 202 or 204, Put call must return 202 or 201 or 200, but 409 being returned"
      );
    });
  });

  describe("string length validation", () => {
    it("should fail when the provided string is greater than maximum length", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/stringLength/maxLength/test.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "MAX_LENGTH");
      assert.strictEqual(result[0].message, "String is too long (258 chars), maximum 256");
    });

    it("should fail when the provided string is less than minimum length", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/stringLength/minLength/test.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "MIN_LENGTH");
      assert.strictEqual(result[0].message, "String is too short (10 chars), minimum 11");
    });
  });

  describe("write only properties validation", () => {
    it("should fail when finding write only properties in the request", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/validateWriteOnly/test.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "WRITEONLY_PROPERTY_NOT_ALLOWED_IN_RESPONSE");
      assert.strictEqual(
        result[0].message,
        'Write-only property "cores" is not allowed in the response'
      );
    });
  });

  describe("parameter required validation", () => {
    it("should fail when missing write required parameters in example", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/parameterRequiredValidation/test.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "REQUIRED_PARAMETER_EXAMPLE_NOT_FOUND");
      assert.strictEqual(
        result[0].message,
        "In operation SqlServers_Get, parameter peeringServiceName is required in the swagger spec but is not present in the provided example parameter values."
      );
    });
  });

  describe("x-ms-examples validation", () => {
    it("should fail when missing example defined in operation", async () => {
      const specPath2 = `${testPath}/modelValidation/swaggers/specification/xmsExampleNotFound/test.json`;
      const result = await validate.validateExamples(specPath2, undefined);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "XMS_EXAMPLE_NOTFOUND_ERROR");
      assert.strictEqual(result[0].message, "x-ms-example not found in Operations_List.");
    });
  });

  describe("specPath validation", () => {
    it("should fail when specPath is an empty string", async () => {
      const specPath2 = "";
      const operationIds = undefined;
      const result = await validate.validateExamples(specPath2, operationIds);
      console.log(`result: ${JSON.stringify(result)}`);
      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].code, "INTERNAL_ERROR");
      assert.strictEqual(result[0].message, "Unexpected internal error");
    });

    it("should pass when specPath is a url starting with https://github", async () => {
      const specPath2 =
        "https://github.com/Azure/azure-rest-api-specs/blob/main/specification/applicationinsights/resource-manager/Microsoft.Insights/preview/2021-03-03-preview/diagnosticServicesToken_API.json";
      const operationIds = undefined;
      const result = await validate.validateExamples(specPath2, operationIds);
      console.log(`result: ${JSON.stringify(result)}`);
      // assert.strictEqual(result.length, 1);
      // assert.strictEqual(result[0].code, "INTERNAL_ERROR");
      // assert.strictEqual(result[0].message, "Unexpected internal error");
    });
  });
});
