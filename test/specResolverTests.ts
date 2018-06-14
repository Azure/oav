// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { SpecResolver } from "../lib/validators/specResolver";

describe("specResolver", () => {
  it("create", async () => {
    const spec = {}
    const resolver = new SpecResolver("./", spec, {})
    await resolver.resolve()
  })
})
