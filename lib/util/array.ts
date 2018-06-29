// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { objectPathAppend } from "./objectPath"
import { Tracked, tracked } from "./tracked"

export function arrayMap<T>(array: Tracked<T[]>, f: (value: Tracked<T>) => T) {
  const path = array.path
  const value = array.value
  let same = true
  const result = value.map((item, i) => {
    const newItem = f(tracked(item, objectPathAppend(path, i)))
    same = same && (newItem === item)
    return newItem
  })
  return same ? value : result
}
