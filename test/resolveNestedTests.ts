// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import assert from "assert";
import * as sway from "yasway";
import { jsonSymbol } from "z-schema";

import { SpecValidator } from "../lib/validators/specValidator";

const options: sway.Options = {
  definition: {
    swagger: "2.0",
    info: { title: "sometitle", version: "2018" },
    definitions: {
      A: {
        properties: {
          a: {
            type: "string",
          },
          b: {
            properties: {
              c: {
                type: "string",
              },
            },
            // additionalProperties: false,
            required: ["c"],
          },
          "@": {
            properties: {
              c: {
                type: "string",
              },
            },
          },
        },
        required: ["a", "b"],
        // additionalProperties: false
      },
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
                $ref: "#/definitions/A",
              },
            },
          ],
          responses: {
            200: {
              description: "200 response",
              schema: {
                type: "file",
              },
            },
          },
        },
      },
    },
  },
  jsonRefs: { relativeBase: undefined },
};

describe("resolve nested properties", () => {
  it("should pass if an example has no nested additional properties", async () => {
    const request = {
      url: "example.com",
      method: "x",
      body: {
        a: "somevalue",
        b: {
          c: "somevalue",
          // d: "anothervalue"
        },
        "@": {
          c: "somevalue",
        },
        // d: 54
      },
    };

    const specValidation = new SpecValidator("./", options.definition, {});
    const api = await specValidation.initialize();
    const apiOperations = api.getOperations();
    const apiOperation = apiOperations[0];
    const apiValidationResult = apiOperation.validateRequest(request);
    assert.strictEqual(apiValidationResult.errors.length, 0);
  });

  it("should fail if an example has nested additional properties", async () => {
    const request = {
      url: "example.com",
      method: "x",
      body: {
        a: "somevalue",
        b: {
          c: "somevalue",
          d: "anothervalue",
        },
        // d: 54
      },
    };

    const specValidation = new SpecValidator("./", options.definition, {});
    const api = await specValidation.initialize();
    const apiOperations = api.getOperations();
    const apiOperation = apiOperations[0];
    const apiValidationResult = apiOperation.validateRequest(request);

    assert.strictEqual(apiValidationResult.errors.length, 1);
    const error = apiValidationResult.errors[0].errors[0];
    const json = (error as any)[jsonSymbol];
    assert.strictEqual(json, request.body);
  });
});
