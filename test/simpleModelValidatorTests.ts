import { SwaggerObject } from "yasway"
import assert = require('assert')
import { ModelValidator } from '../lib/validators/modelValidator'
import { parse } from '@ts-common/json-parser';
import { getErrorsFromModelValidation } from '../lib/util/getErrorsFromModelValidation';

describe("simple model validation tests", () => {
  it("semantic validation with generated CloudError", async () => {
    const spec: SwaggerObject = {
      swagger: "2.0",
      info: { title: "sometitle", version: "2018" },
      paths: {
        "/somepath": {
          get: {
            operationId: "op",
            responses: {
              default: {
                description: "Default response.",
                schema: {
                  type: "string"
                },
                examples: {
                  "application/json": []
                }
              }
            }
          }
        }
      }
    }
    const specJson = JSON.stringify(spec)
    const specParsed = parse("url", specJson) as SwaggerObject
    const validator = new ModelValidator(
      "some/file/path",
      specParsed,
      {
        shouldModelImplicitDefaultResponse: true
      }
    )
    const api = await validator.initialize()
    validator.validateOperations()
    const result = validator.specValidationResult
    const o = result.operations.op
    if (o === undefined) {
      throw new Error("o === undefined")
    }
    const e = o["example-in-spec"]
    if (e === undefined) {
      throw new Error("e === undefined")
    }
    const er = e.responses
    if (er === undefined) {
      throw new Error("er === undefined")
    }
    const err = er.default.error
    if (err === undefined) {
      throw new Error("err === undefined")
    }
    assert.strictEqual(err.code, "RESPONSE_VALIDATION_ERROR")
    assert.notStrictEqual(api, undefined)
    const errors = getErrorsFromModelValidation(result)
    assert.strictEqual(errors.length, 2)
  })
})
