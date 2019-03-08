import * as assert from "assert"
import { SwaggerObject } from "yasway"

import { SemanticValidator } from "../lib/validators/semanticValidator"

describe("Simple semantic validation", () => {
  it("a valid minimal swagger should pass semantic validation", async () => {
    const spec: SwaggerObject = {
      swagger: "2.0",
      info: { title: "sometitle", version: "2018" }
    }
    const semanticValidator = new SemanticValidator("some/file/path", spec, {})
    const api = await semanticValidator.initialize()
    const result = await semanticValidator.validateSpec()
    assert.notStrictEqual(api, undefined)
    assert.strictEqual(result.errors.length, 0)
  })

  it("semantic validation with generated CloudError", async () => {
    const spec: SwaggerObject = {
      swagger: "2.0",
      info: { title: "sometitle", version: "2018" },
      paths: {
        "/somepath": {
          get: {
            responses: {
              default: {
                description: "Default response."
              }
            }
          }
        }
      }
    }
    const semanticValidator = new SemanticValidator("some/file/path", spec, {})
    const api = await semanticValidator.initialize()
    const result = await semanticValidator.validateSpec()
    assert.notStrictEqual(api, undefined)
    assert.strictEqual(result.errors.length, 0)
  })
})
