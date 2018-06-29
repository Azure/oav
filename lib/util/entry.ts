// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

export type Entry<T> = [string, T]

export function entry<T>(n: string, v: T): Entry<T> {
  return [n, v]
}

export function entryName<T>(e: Entry<T>): string {
  return e[0]
}

export function entryValue<T>(e: Entry<T>): T {
  return e[1]
}

/*
export function entryMap<T>(e: Entry<T>, f: (value: T, name: string) => T): Entry<T> {
  return entry(entryName(e), f(entryValue(e), entryName(e)))
}
*/
