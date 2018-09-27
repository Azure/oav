// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { fold, isArray } from "@ts-common/iterator"

export interface Dummy {
  [v: string]: Dummy | undefined
}

export const createDummy = (): Dummy => ({})

export const createDummyByPath = (objectPath: string | string[] | undefined): Dummy => {
  const result = createDummy()
  if (objectPath === undefined) {
    return result
  }
  const split = isArray(objectPath) ? objectPath : objectPath.split("/").filter(v => v.length > 0)
  fold(
    split,
    (o, key) => {
      const value = createDummy()
      o[key] = value
      return value
    },
    result
  )
  return result
}
