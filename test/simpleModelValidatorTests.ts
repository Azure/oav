import { SwaggerObject } from "yasway"
import assert = require('assert');
import { ModelValidator } from '../lib/validators/modelValidator';
import { getErrorsFromModelValidation } from '../lib/util/getErrorsFromModelValidation';

describe("simple model validation tests", () => {
  it("semantic validation with generated CloudError", async () => {
    const spec: SwaggerObject = {
      swagger: "2.0",
      info: { title: "sometitle", version: "2018" },
      paths: {
        "/somepath": {
          get: {
            responses: {
              default: {
                description: "Default response.",
                examples: {
                  "application/json": {}
                }
              }
            }
          }
        }
      }
    }
    const validator = new ModelValidator(
      "some/file/path",
      spec,
      {
        shouldModelImplicitDefaultResponse: true
      }
    )
    const api = await validator.initialize()
    validator.validateOperations()
    const result = validator.specValidationResult
    assert.notStrictEqual(api, undefined)
    assert.strictEqual(getErrorsFromModelValidation(result).length, 0)
  })
})
