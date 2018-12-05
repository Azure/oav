// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { FilePosition } from '@ts-common/source-map';
import * as errorCodes from "./errorCodes"

export interface CommonError {
  readonly code?: errorCodes.Code
  readonly message?: string
  readonly innerErrors?: CommonError[]
  path?: string | string[]
  readonly inner?: CommonError[]
  errors?: CommonError[]
  in?: unknown
  name?: string
  params?: Array<unknown>
  jsonUrl?: string
  jsonPosition?: FilePosition
}
