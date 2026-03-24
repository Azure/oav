// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { BaseValidationError } from "./baseValidationError.js";
import { NodeError } from "./validationError.js";

export interface ModelValidationError
  extends BaseValidationError<ModelValidationError>,
    NodeError<ModelValidationError> {
  operationId?: string;
  scenario?: string;
  responseCode?: string;
  readonly innerErrors?: ModelValidationError[];
}
