// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { SpecResolver, Options } from "../lib/validators/specResolver"
import { SwaggerObject } from "yasway"

describe("specResolver", () => {
  it("create", async () => {
    const spec: SwaggerObject = {
      definitions: {
        A: {
          allOf: [
            {},
            {}
          ]
        }
      }
    }
    const options: Options = { shouldResolveAllOf: true }
    const resolver = new SpecResolver("./", spec, options)
    await resolver.resolve()
  })
})
