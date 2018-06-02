/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 */

/**
 * @class
 * Initializes a new instance of the PotentialOperationsResult class.
 *
 * @constructor
 * Provides information about the issue that occured while performing
 * live request and response validation.
 *
 * @member {Array<Operation>} List of potential operations found.
 *
 * @member {LiveValidationError} Reason when potential operations were empty.
 *
 */
export class PotentialOperationsResult {
  public readonly operations: any[]
  public readonly reason: any
  constructor(operations: any[], reason: any) {
    this.operations = operations || []
    if (reason) {
      this.reason = reason
    }
  }
}
