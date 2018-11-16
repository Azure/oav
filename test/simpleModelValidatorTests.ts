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
    assert.notStrictEqual(api, undefined)
    const errors = getErrorsFromModelValidation(result)
    assert.strictEqual(errors.length, 2)
  })
})
