// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { Severity } from "./severity"
import { ValidationResultSource } from "./validationResultSource"
import { NodeError } from './validationError';

export interface BaseValidationError {
  severity?: Severity
  errorCode?: string
  errorDetails?: NodeError<any>
  source?: ValidationResultSource
  count?: number
}
