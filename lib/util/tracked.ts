// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { ObjectPath } from "./objectPath"

export interface Tracked<T> {
  readonly value: T
  readonly path: ObjectPath
}

export function tracked<T>(value: T, path: ObjectPath): Tracked<T> {
  return { value: value, path: path }
}
