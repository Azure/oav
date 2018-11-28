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
      consumes: [ "application/json" ],
      produces: [ "application/json" ],
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
                    invalid: 3,
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
    assert.notStrictEqual(api, undefined)
    const errors = getErrorsFromModelValidation(result)
    assert.strictEqual(errors.length, 1)
    if (errors[0].errorDetails === undefined) {
      throw new Error("errors[0].errorDetails === undefined")
    }
    // make sure it has source map.
    assert.notStrictEqual(errors[0].errorDetails.position, undefined);
  })
})
