// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { StringMap } from "@ts-common/string-map"
import { stringMapMap } from "./stringMap"
import { NonUndefined } from "@ts-common/json"
import { objectPathLast } from "./objectPath"
import { Tracked } from "./tracked";

export type PropertyTransformation<T> = (value: Tracked<T>) => T

/**
 * Type safe property transformations.
 */
export type PropertySetTransformation<T> = {
  readonly [K in (keyof T & string)]?: PropertyTransformation<NonUndefined<T[K]>>
}

/**
 * Clones the given `propertySet` and transforms its properties according to the given
 * `propertyTransformations`.
 * @param propertySet must be a tracked object of a pure data object with properties.
 * @param propertySetTransformation
 * @returns a new object with transformed properties.
 */
export function propertySetMap<T>(
  propertySet: Tracked<T>,
  propertySetTransformation: PropertySetTransformation<T>
): T {
  const untypedPropertySet = propertySet as Tracked<StringMap<unknown>>
  const untypedPropertySetTransformation =
    propertySetTransformation as PropertySetTransformation<StringMap<unknown>>
  const result = stringMapMap(
    untypedPropertySet,
    t => {
      if (t.value === undefined) {
        return undefined
      }
      const f = untypedPropertySetTransformation[objectPathLast(t.path)]
      return f !== undefined ? f(t) : t.value
    })
  return result as T
}
