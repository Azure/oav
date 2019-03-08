import { parse } from "@ts-common/json-parser"
import assert = require("assert")
import { SwaggerObject } from "yasway"

import { getErrorsFromModelValidation } from "../lib/util/getErrorsFromModelValidation"
import { ModelValidator } from "../lib/validators/modelValidator"

describe("simple model validation tests", () => {
  it("semantic validation without generated CloudError", async () => {
    const spec: SwaggerObject = {
      swagger: "2.0",
      info: { title: "sometitle", version: "2018" },
      consumes: ["application/json"],
      produces: ["application/json"],
      paths: {
        "/somepath": {
          get: {
            operationId: "op",
            responses: {
              default: {
                description: "Default response.",
                schema: {
                  type: "object",
                  additionalProperties: false
                },
                examples: {
                  "application/json": {
                    invalid: 3
                  }
                }
              }
            }
          }
        }
      }
    }
    const specJson = JSON.stringify(spec)
    const specParsed = parse("url", specJson) as SwaggerObject
    const validator = new ModelValidator("some/file/path", specParsed, {})
    const api = await validator.initialize()
    validator.validateOperations()
    const result = validator.specValidationResult
    assert.notStrictEqual(api, undefined)
    const errors = getErrorsFromModelValidation(result)
    assert.strictEqual(errors.length, 1)
    assert.strictEqual(errors[0].code, "OBJECT_ADDITIONAL_PROPERTIES")
  })
})
