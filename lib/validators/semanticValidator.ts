// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { SpecValidator, CommonValidationResult } from "./specValidator"
import * as Sway from "yasway"
import { log } from "../util/logging"
import { validateResponse } from "../util/validationResponse"
import * as C from "../util/constants"
import * as util from "util"
import { CommonError } from "../util/commonError"
import { keys } from "@ts-common/string-map"
import { processErrors } from "../util/processErrors"
import * as errorCodes from "../util/errorCodes"

export interface Result {
  isValid?: unknown
  error?: CommonError
  warning?: unknown
  result?: unknown
  errors?: unknown
  warnings?: unknown
}

export interface SemanticValidationResult extends CommonValidationResult {
  validateSpec?: Result
  initialize?: unknown
}

export class SemanticValidator extends SpecValidator<SemanticValidationResult> {

  public async validateSpec(): Promise<Sway.ValidationResults> {
    this.specValidationResult.validateSpec = {
      isValid: true,
      errors: [],
      warnings: [],
    }
    if (!this.swaggerApi) {
      const msg =
        `Please call "specValidator.initialize()" before calling this method, ` +
        `so that swaggerApi is populated.`
      const code: errorCodes.Code = "INITIALIZATION_ERROR"
      const e = this.constructErrorObject(code, msg)
      this.specValidationResult.initialize = e
      this.specValidationResult.validateSpec.isValid = false
      log.error(`${code}: ${msg}`)
      throw e
    }
    try {
      const validationResult = this.swaggerApi.validate()
      if (validationResult) {
        if (validationResult.errors && validationResult.errors.length) {
          this.specValidationResult.validateSpec.isValid = false
          processErrors(validationResult.errors)
          const e = this.constructErrorObject(
            "SEMANTIC_VALIDATION_ERROR",
            `The spec ${this.specPath} has semantic validation errors.`,
            validationResult.errors as any[])
          this.specValidationResult.validateSpec.errors = validateResponse.constructErrors(
            e,
            this.specPath,
            this.getProviderNamespace()
          )
          log.error(C.Errors)
          log.error("------")
          this.updateValidityStatus()
          log.error(e as any)
        } else {
          this.specValidationResult.validateSpec.result =
            `The spec ${this.specPath} is semantically valid.`
        }
        if (validationResult.warnings && validationResult.warnings.length > 0) {
          processErrors(validationResult.warnings)
          validationResult.warnings = validateResponse.sanitizeWarnings(validationResult.warnings)
          if (validationResult.warnings && validationResult.warnings.length > 0) {
            this.specValidationResult.validateSpec.warnings = validationResult.warnings
            log.debug(C.Warnings)
            log.debug("--------")
            log.debug(util.inspect(validationResult.warnings))
          }
        }
      }
      return validationResult
    } catch (err) {
      const msg =
        `An Internal Error occurred in validating the spec "${this.specPath}". \t${err.message}.`
      const code: errorCodes.Code = "INTERNAL_ERROR"
      err.code = code
      err.message = msg
      this.specValidationResult.validateSpec.isValid = false
      this.specValidationResult.validateSpec.error = err
      log.error(err)
      this.updateValidityStatus()
      throw err
    }
  }

  private getProviderNamespace(): string | null {
    const re = /^(.*)\/providers\/(\w+\.\w+)\/(.*)$/ig
    if (this.specInJson) {
      if (this.specInJson.paths) {
        for (const pathStr of keys(this.specInJson.paths)) {
          const res = re.exec(pathStr)
          if (res && res[2]) {
            return res[2]
          }
        }
      }
    }
    return null
  }
}
