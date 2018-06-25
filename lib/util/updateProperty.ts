// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

export function updateProperty<T, K extends keyof T>(
  obj: T, k: K, update: (v: T[K], k: K) => T[K])
  : void {

  const newValue = update(obj[k], k)
  if (newValue === undefined) {
    delete obj[k]
  } else {
    obj[k] = newValue
  }
}
