// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information

/**
 * Use this functions to assign optional properties.
 * The function will not create the property `k` if the given value is `undefined`.
 *
 * @param o an object
 * @param k a name of property
 * @param v a property value
 */
export const assignOptional = <K extends string, V>(
  o: { [key in K]?: V },
  k: K,
  v: V | undefined
) => {
  if (v === undefined) {
    o[k] = v
  }
}
