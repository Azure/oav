// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { Severity } from "./severity"
import { ValidationResultSource } from "./validationResultSource"

export interface SerializedError {
  readonly code: string
  similarPaths: string[]
}

export interface BaseValidationError {
  severity?: Severity
  errorCode?: string
  errorDetails?: string | SerializedError
  source?: ValidationResultSource
  count?: number
}
