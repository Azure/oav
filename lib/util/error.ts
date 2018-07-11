// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { Unknown } from "./unknown"

export interface Error {
  readonly code: string
  readonly id: string
  readonly message: string
  readonly innerErrors?: Error[]
  path?: string|string[]
  readonly inner?: Error[]
  errors?: Error[]
  in?: Unknown
  name?: string
  params?: Unknown[]
}
