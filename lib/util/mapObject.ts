// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

export interface MapObject<T> {
  [name: string]: T
}

export function objectMap<T>(src: MapObject<T>, f: (v: T, name: string) => T): MapObject<T> {
  const result: MapObject<T> = {}
  for (const name in src) {
    result[name] = f(src[name], name)
  }
  return result
}
