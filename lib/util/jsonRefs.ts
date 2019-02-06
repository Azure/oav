// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as jsonRefs from "json-refs"
import * as sm from "@ts-common/string-map"

export { UnresolvedRefDetails } from "json-refs"

export const findRefs = (
  obj: object | ReadonlyArray<unknown>,
  options?: jsonRefs.JsonRefsOptions
): sm.StringMap<jsonRefs.UnresolvedRefDetails> =>
  jsonRefs.findRefs(obj, options) as sm.StringMap<jsonRefs.UnresolvedRefDetails>
