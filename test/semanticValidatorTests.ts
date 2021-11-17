// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import assert from "assert";
import * as constants from "../lib/util/constants";
import * as validate from "../lib/validate";

const testPath = __dirname;

describe("Semantic validation", () => {
  describe("loadSwagger", () => {
    // JSON_PARSING_ERROR
    it("should fail when validating a JSON file which cannot be parsed successfully", async () => {
      const specPath = `${testPath}/semanticValidation/specification/loadSwagger/JSON_PARSING_ERROR.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(
        result.validateSpec?.errors?.[0].code,
        constants.ErrorCodes.JsonParsingError.name
      );
    });
    // UNRESOLVABLE_REFERENCE
    it("should fail when validating a swagger with unresolvable reference", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateSwaggerSchema/UNRESOLVABLE_REFERENCE.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "UNRESOLVABLE_REFERENCE");
    });
    it("should validate correctly when the spec contains an x-ms-parameterized-host", async () => {
      const specPath = `${testPath}/semanticValidation/specification/parameterizedhost/face.json`;
      const result = await validate.validateSpec(specPath, undefined);
      // console.dir(result, { depth: null })
      assert(
        result.validityStatus === true,
        `swagger "${specPath}" contains semantic validation errors.`
      );
    });
    it("should validate correctly when the spec does not contain a definitions section", async () => {
      const specPath = `${testPath}/semanticValidation/specification/definitions/definitions.json`;
      const result = await validate.validateSpec(specPath, undefined);
      // console.dir(result, { depth: null })
      assert(
        result.validityStatus === true,
        `swagger "${specPath}" contains semantic validation errors.`
      );
    });
    it("should fail when validating a swagger with invalid internal reference", async () => {
      const specPath = `${testPath}/semanticValidation/specification/invalidReference/searchindex.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
    });
  });

  describe("internalErrors", () => {
    // internalErrors: INTERNAL_ERROR
    it("should fail when validating a swagger with internal error", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateSwaggerSchema/internalErrors/INTERNAL_ERROR.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(
        result.validateSpec?.errors?.[0].code,
        constants.ErrorCodes.InternalError.name
      );
    });
  });

  describe("validateSwaggerSchema", () => {
    // OBJECT_ADDITIONAL_PROPERTIES
    it("should fail when adding properties not allowed", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateSwaggerSchema/AddPropertiesNotAllowed.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "OBJECT_ADDITIONAL_PROPERTIES");
    });
    // ARRAY_UNIQUE
    it("should fail when have array which items are not unique", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateSwaggerSchema/ARRAY_UNIQUE.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "ARRAY_UNIQUE");
    });
    // ENUM_MISMATCH
    it("should fail when validating a swagger with No enum match error", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateSwaggerSchema/ENUM_MISMATCH.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "ENUM_MISMATCH");
    });
  });

  describe("validateCompile", () => {
    // INTERNAL_ERROR
    it("should fail when cannot compile validator on operation", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateCompile/Compile-INTERNAL_ERROR.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "INTERNAL_ERROR");
      assert.strictEqual(
        result.validateSpec?.errors?.[0].message.slice(0, 40),
        "Failed to compile validator on operation"
      );
    });
  });

  describe("validateDiscriminator", () => {
    // DISCRIMINATOR_NOT_REQUIRED
    it("should fail when discriminator is not a required property", async () => {
      const specPath = `${testPath}/semanticValidation/specification/discriminator/notRequiredDiscriminator.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "DISCRIMINATOR_NOT_REQUIRED");
    });
    // OBJECT_MISSING_REQUIRED_PROPERTY_DEFINITION
    it("should fail when missing required property in definition", async () => {
      const specPath = `${testPath}/semanticValidation/specification/discriminator/OBJECT_MISSING_REQUIRED_PROPERTY_DEFINITION.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(
        result.validateSpec?.errors?.[0].code,
        "OBJECT_MISSING_REQUIRED_PROPERTY_DEFINITION"
      );
    });
    // DISCRIMINATOR_PROPERTY_TYPE_NOT_STRING
    it("should fail when discriminator property type is not string", async () => {
      const specPath = `${testPath}/semanticValidation/specification/discriminator/DISCRIMINATOR_PROPERTY_TYPE_NOT_STRING.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(
        result.validateSpec?.errors?.[0].code,
        "DISCRIMINATOR_PROPERTY_TYPE_NOT_STRING"
      );
    });
    // DISCRIMINATOR_VALUE_NOT_IN_ENUM
    it("should fail when discriminator value is not in enum list", async () => {
      const specPath = `${testPath}/semanticValidation/specification/discriminator/DISCRIMINATOR_VALUE_NOT_IN_ENUM.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "DISCRIMINATOR_VALUE_NOT_IN_ENUM");
    });
    // DISCRIMINATOR_MISSING_IN_PARENT
    it("should fail when parent's discriminator is missing", async () => {
      const specPath = `${testPath}/semanticValidation/specification/discriminator/DISCRIMINATOR_MISSING_IN_PARENT.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "DISCRIMINATOR_MISSING_IN_PARENT");
    });
  });

  describe("validateSchemaRequiredProperties", () => {
    // OBJECT_MISSING_REQUIRED_PROPERTY_SCHEMA
    it("should fail when validating a swagger with missing required property", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateSchemaRequiredProperties/OBJECT_MISSING_REQUIRED_PROPERTY_SCHEMA.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(
        result.validateSpec?.errors?.[0].code,
        "OBJECT_MISSING_REQUIRED_PROPERTY_SCHEMA"
      );
    });
  });

  describe("validateOperation", () => {
    // EMPTY_PATH_PARAMETER_DECLARATION
    it("should fail when has empty path parameter declaration", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateOperation/EMPTY_PATH_PARAMETER_DECLARATION.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "EMPTY_PATH_PARAMETER_DECLARATION");
    });
    // EQUIVALENT_PATH
    it("should fail when equivalent path already exists", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateOperation/EQUIVALENT_PATH.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "EQUIVALENT_PATH");
    });
    // DUPLICATE_OPERATIONID
    it("should fail when has multiple operations with the same operationId", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateOperation/DUPLICATE_OPERATIONID.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "DUPLICATE_OPERATIONID");
    });
    // DUPLICATE_PARAMETER
    it("should fail when operation has duplicate parameters", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateOperation/DUPLICATE_PARAMETER.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "DUPLICATE_PARAMETER");
    });
    // MULTIPLE_BODY_PARAMETERS
    it("should fail when operation has multiple body parameters", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateOperation/MULTIPLE_BODY_PARAMETERS.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "MULTIPLE_BODY_PARAMETERS");
    });
    // INVALID_PARAMETER_COMBINATION
    it("should fail when operation has a body parameter and a formData parameter", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateOperation/INVALID_PARAMETER_COMBINATION.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(result.validateSpec?.errors?.[0].code, "INVALID_PARAMETER_COMBINATION");
    });
    // MISSING_PATH_PARAMETER_DECLARATION
    it("should fail when path parameter is defined but is not declared", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateOperation/MISSING_PATH_PARAMETER_DECLARATION.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(
        result.validateSpec?.errors?.[0].code,
        "MISSING_PATH_PARAMETER_DECLARATION"
      );
    });
    // MISSING_PATH_PARAMETER_DEFINITION
    it("should fail when path parameter is declared but is not defined", async () => {
      const specPath = `${testPath}/semanticValidation/specification/validateOperation/MISSING_PATH_PARAMETER_DEFINITION.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === false);
      assert.strictEqual(
        result.validateSpec?.errors?.[0].code,
        "MISSING_PATH_PARAMETER_DEFINITION"
      );
    });
    it("should succeed when discriminator is not a required property and the error is suppressed", async () => {
      const specPath = `${testPath}/semanticValidation/specification/discriminator/notRequiredDiscriminatorWithSuppression.json`;
      const result = await validate.validateSpec(specPath, undefined);
      assert(result.validityStatus === true);
    });
  });
});
