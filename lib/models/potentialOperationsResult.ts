/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 */

import { Operation } from "yasway";

import { LiveValidationError } from "./liveValidationError";

/**
 * @class
 * Initializes a new instance of the PotentialOperationsResult class.
 *
 * @constructor
 * Provides information about the issue that occurred while performing
 * live request and response validation.
 *
 * @member {Array<Operation>} List of potential operations found.
 *
 * @member {LiveValidationError} Reason when potential operations were empty.
 *
 */
export class PotentialOperationsResult {
  public constructor(
    public readonly operations: Operation[],
    public readonly resourceProvider: string,
    public readonly apiVersion: string,
    public readonly reason?: undefined | LiveValidationError
  ) {
    this.operations = operations || [];
    if (reason) {
      this.reason = reason;
    }
  }
}
