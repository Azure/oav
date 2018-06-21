// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { Methods, JsonPath, JsonOperation } from "sway"

export const methods: Methods[] = ["get", "put", "post", "delete", "options", "head", "patch"]

export function *getOperations(p: JsonPath): Iterable<JsonOperation> {
  for (const v of methods) {
    const result = p[v]
    if (result !== undefined) {
      yield result
    }
  }
}
