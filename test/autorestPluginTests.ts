// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as ap from "../lib/autorestPlugin/extension"
import { SwaggerObject } from "yasway"

describe("autorestPlugin/pluginHost", () => {
  it("shouldn't fail if no scenarios", async () => {
    const swagger: SwaggerObject = {
      paths: {
        "/somepath/": {
          get: {}
        }
      }
    }
    await ap.openApiValidationExample(swagger, "path")
  })
})
