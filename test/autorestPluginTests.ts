// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { SwaggerObject } from "yasway";

import * as ap from "../lib/autorestPlugin/extension";

describe("autorestPlugin/pluginHost", () => {
  it("shouldn't fail if no scenarios", async () => {
    const swagger: SwaggerObject = {
      swagger: "2.0",
      info: { title: "sometitle", version: "2018" },
      paths: {
        "/somepath/": {
          get: {
            responses: {},
          },
        },
      },
    };
    await ap.openApiValidationExample(swagger, "path");
  });
});
