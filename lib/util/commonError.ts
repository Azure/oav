// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { Unknown } from "./unknown"

export interface CommonError {
  readonly code?: string
  readonly id?: string
  readonly message?: string
  readonly innerErrors?: CommonError[]
  path?: string|string[]
  readonly inner?: CommonError[]
  errors?: CommonError[]
  in?: Unknown
  name?: string
  params?: Unknown[]
}
