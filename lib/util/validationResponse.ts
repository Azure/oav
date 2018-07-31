// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as pointer from "json-pointer"
import { CommonError } from "./commonError"
import { Unknown } from "./unknown"
import { StringMap } from "@ts-common/string-map"

interface ValidationError {
  validationCategory: string
  code?: string
  providerNamespace: Unknown
  type: string
  inner?: CommonError|CommonError[]
  id?: Unknown
  message?: string
  jsonref?: string
  "json-path"?: string
}

interface Warning {
  readonly code: Unknown
}

export class ValidateResponse {

  private readonly mapper: StringMap<string> = {
    SWAGGER_SCHEMA_VALIDATION_ERROR: "M6000",
    INVALID_PARAMETER_COMBINATION: "M6001",
    MULTIPLE_BODY_PARAMETERS: "M6002",
    DUPLICATE_PARAMETER: "M6003",
    DUPLICATE_OPERATIONID: "M6004",
    MISSING_PATH_PARAMETER_DEFINITION: "M6005",
    EMPTY_PATH_PARAMETER_DECLARATION: "M6006",
    EQUIVALENT_PATH: "M6008",
    UNRESOLVABLE_REFERENCE: "M6010",
    INVALID_TYPE: "M6011",
    CIRCULAR_INHERITANCE: "M6012",
    OBJECT_MISSING_REQUIRED_PROPERTY: "M6013",
    OBJECT_MISSING_REQUIRED_PROPERTY_DEFINITION: "M6014",
    ENUM_MISMATCH: "M6015",
    ENUM_CASE_MISMATCH: "M6016"
  }

  public constructErrors(
    validationError: CommonError, specPath: Unknown, providerNamespace: Unknown
  ): ValidationError[] {
    if (!validationError) {
      throw new Error("validationError cannot be null or undefined.")
    }
    const errors = validationError.innerErrors as CommonError[]
    return errors.map(error => {
      const e: ValidationError = {
        validationCategory: "SwaggerViolation",
        providerNamespace,
        type: "error",
        inner: error.inner
      }
      if (error.code && this.mapper[error.code]) {
        e.code = error.code
        e.id = this.mapper[error.code]
        e.message = error.message
      } else {
        e.code = "SWAGGER_SCHEMA_VALIDATION_ERROR"
        e.message = validationError.message
        e.id = this.mapper[e.code]
        e.inner = error
      }
      if (error.path && error.path.length) {
        const paths = [specPath + "#"].concat(error.path)
        const jsonpath = pointer.compile(paths)
        e.jsonref = jsonpath
        e["json-path"] = pointer.unescape(jsonpath)
      }
      return e
    })
  }

  public sanitizeWarnings(warnings: Warning[]): Warning[] {
    if (!warnings) {
      throw new Error("validationError cannot be null or undefined.")
    }
    return warnings.filter(warning => warning.code
      && warning.code !== "EXTRA_REFERENCE_PROPERTIES"
      && warning.code !== "UNUSED_DEFINITION")
  }

  /*
  private seralize() {
    const result: { ["json-path"]?: Unknown } = {}
    for (const prop in this) {
      if (this[prop] !== null && this[prop] !== undefined) {
        if (prop === "jsonpath") {
          result["json-path"] = this[prop]
        }
      }
    }
    return result
  }
  */
}

export const validateResponse = new ValidateResponse()
