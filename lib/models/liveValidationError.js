/*
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for
 * license information.
 */

'use strict';

/**
 * @class
 * Initializes a new instance of the LiveValidationError class.
 * 
 * @constructor
 * Provides information about the issue that occured while performing
 * live request and response validation.
 *
 * @member {string} code Unique error code.
 *
 * @member {string} message Detailed error message.
 *
 */
class LiveValidationError {
  constructor(code, message) {
    this.code = code;
    this.message = message;
  }

  /**
   * Defines the metadata of LiveValidationError
   *
   * @returns {object} metadata of LiveValidationError
   *
   */
  mapper() {
    return {
      required: false,
      serializedName: 'LiveValidationError',
      type: {
        name: 'Composite',
        className: 'LiveValidationError',
        modelProperties: {
          code: {
            required: true,
            serializedName: 'code',
            type: {
              name: 'String'
            }
          },
          message: {
            required: true,
            serializedName: 'message',
            type: {
              name: 'String'
            }
          }
        }
      }
    };
  }
}

module.exports = LiveValidationError;
