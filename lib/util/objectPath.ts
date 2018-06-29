// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

export type ObjectPath = Array<string|number>

export function objectPathAppend(path: ObjectPath, key: string|number): ObjectPath {
  return [...path, key]
}

export function objectPathLast(path: ObjectPath): string|number {
  return path[path.length - 1]
}
