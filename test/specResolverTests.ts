// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { defaultErrorReport } from "@azure-tools/openapi-tools-common";

import { SwaggerObject } from "yasway";
import { Options, SpecResolver } from "../lib/validators/specResolver";

describe("specResolver", () => {
  it("create", async () => {
    const spec: SwaggerObject = {
      swagger: "2.0",
      info: { title: "sometitle", version: "2018" },
      definitions: {
        A: {
          allOf: [{}, {}],
        },
      },
    };
    const options: Options = { shouldResolveAllOf: true };
    const resolver = new SpecResolver("./", spec, options, defaultErrorReport);
    await resolver.resolve(undefined);
  });
});
