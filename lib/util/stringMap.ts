// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { objectPathAppend, objectPathLast } from "./objectPath"
import { Tracked, tracked } from "./tracked";
import { NonUndefined } from "./nonUndefined"
import { StringMap } from "@ts-common/string-map"

export function stringMapForEach<T>(
  src: Tracked<StringMap<T>>, f: (value: Tracked<NonUndefined<T>>) => void
): void {
  const sv = src.value
  for (const name in sv) {
    const value = sv[name]
    if (value !== undefined) {
      f(tracked(value as NonUndefined<T>, objectPathAppend(src.path, name)))
    }
  }
}

export function stringMapMap<T>(
  src: Tracked<StringMap<T>>, f: (value: Tracked<NonUndefined<T>>) => T
): StringMap<T> {
  const result: { [n: string]: T } = {}
  let same = true
  stringMapForEach(
    src,
    propertyTracked => {
      const newProperty = f(propertyTracked)
      result[objectPathLast(propertyTracked.path)] = newProperty
      same = same && (newProperty === propertyTracked.value)
    })
  return same ? src.value : result
}
