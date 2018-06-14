// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { SpecResolver, Options } from "../lib/validators/specResolver"
import { JsonSpec } from "sway"

describe("specResolver", () => {
  it("create", async () => {
    const spec: JsonSpec = {
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
