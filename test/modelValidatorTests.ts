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
          result.length !== 0,
          `swagger "${specPath}" with operation "${operationIds}" contains passed incorrectly.`
        );
        // console.log(result)
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
      const result = await validate.validateExamples(specPath2, undefined, {
        consoleLogLevel: "off",
      });
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
});
