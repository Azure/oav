// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as sm from "@ts-common/string-map"
import * as jsonRefs from "json-refs"

export { UnresolvedRefDetails } from "json-refs"

// https://github.com/whitlockjc/json-refs/pull/153
export const findRefs = (
  obj: object | ReadonlyArray<unknown>,
  options?: jsonRefs.JsonRefsOptions
): sm.StringMap<jsonRefs.UnresolvedRefDetails> =>
  jsonRefs.findRefs(obj, options) as sm.StringMap<jsonRefs.UnresolvedRefDetails>
