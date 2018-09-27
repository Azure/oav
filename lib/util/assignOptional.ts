// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information

export const assignOptional = <K extends string, V>(
  o: { [key in K]?: V },
  k: K,
  v: V | undefined
) => {
  if (v === undefined) {
    o[k] = v
  }
}
