// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as sway from "sway"
import assert from "assert"
import { SpecValidator } from "../lib/validators/specValidator"

describe("sway", () => {
  // SpecResolver:
  // - resolveAllOfInDefinitions (partly recursive, allOf.allOf only)
  // - resolveDiscriminator (partly recursive)
  // - deleteReferencesToAllOf (non recursive)
  // - setAdditionalPropertiesFalse (non recursive)
  // - resolvePureObjects (partly recursive `properties`)
  // - resolveNullableTypes (full recursion)
  it("create", async () => {
    const options: sway.Options = {
      definition: {
        definitions: {
          A: {
            properties: {
              a: {
                type: "string"
              },
              b: {
                properties: {
                  c: {
                    type: "string"
                  }
                },
                // additionalProperties: false,
                required: ["c"]
              }
            },
            required: ["a", "b"],
            // additionalProperties: false
          }
        },
        paths: {
          something: {
            get: {
              parameters: [
                {
                  name: "a",
                  in: "body",
                  required: true,
                  schema: {
                    $ref: "#/definitions/A"
                  }
                }
              ]
            }
          }
        }
      },
      jsonRefs: { relativeBase: undefined }
    }

    const request = {
      url: "example.com",
      method: "x",
      body: {
        a: "somevalue",
        b: {
          c: "somevalue",
          // d: "anothervalue"
        },
        // d: 54
      }
    }

    const specValidation = new SpecValidator("./", options.definition, {})
    const api = await specValidation.initialize()
    const apiOperations = api.getOperations()
    const apiOperation = apiOperations[0]
    const apiValidationResult = apiOperation.validateRequest(request)
    assert.equal(apiValidationResult.errors.length, 0)

    /*
    const result = await sway.create(options)
    const operations = result.getOperations()
    const operation = operations[0]
    const validationResult = operation.validateRequest(request)
    assert.equal(validationResult.errors.length, 0)
    */
  })
})
