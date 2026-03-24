// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { Severity } from "./severity.js";
import { NodeError } from "./validationError.js";
import { ValidationResultSource } from "./validationResultSource.js";

export interface BaseValidationError<T extends NodeError<T>> {
  severity?: Severity;
  code?: string;
  details?: T;
  source?: ValidationResultSource;
  count?: number;
}
