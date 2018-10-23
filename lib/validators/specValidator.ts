// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as path from "path"
import * as Sway from "yasway"
import { SpecResolver } from "./specResolver"
import * as specResolver from "./specResolver"
import * as utils from "../util/utils"
import { log } from "../util/logging"
import { CommonError } from "../util/commonError"
import * as C from "../util/constants"
import { SwaggerObject } from "yasway"
import { ModelValidation } from "../util/getErrorsFromModelValidation"
import { Headers } from "../templates/httpTemplate"
import { StringMap } from "@ts-common/string-map"
import { getSuppressions } from "./suppressions"
import * as amd from "@azure/openapi-markdown"
import { setMutableProperty } from '@ts-common/property-set';

const ErrorCodes = C.ErrorCodes;

export interface Options extends specResolver.Options {
  readonly isPathCaseSensitive?: boolean
}

export interface ErrorCode {
  readonly name: string
  readonly id: string
}

export interface RequestValidation {
  request?: unknown
  validationResult?: Sway.ValidationResults
}

type ResponseValidation = StringMap<Sway.ValidationResults>

export interface ValidationResult {
  exampleNotFound?: CommonError
  scenarios?: ValidationResultScenarios
  readonly requestValidation?: RequestValidation
  readonly responseValidation?: ResponseValidation
}

export interface ValidationResultScenarios {
  [name: string]: ValidationResult
}

export interface SpecValidationResult extends ModelValidation {
  validityStatus: unknown
}

export interface ExampleResponse {
  readonly headers: Headers
  readonly body: unknown
}

export interface CommonValidationResult {
  validityStatus: unknown
  operations: {}
  resolveSpec?: unknown
}

/*
 * @class
 * Performs semantic and data validation of the given swagger spec.
 */
export class SpecValidator<T extends CommonValidationResult> {

  public specValidationResult: T

  protected specInJson: SwaggerObject

  protected swaggerApi: Sway.SwaggerApi | null = null

  protected specPath: string

  private readonly specDir: unknown

  private specResolver: SpecResolver | null

  private readonly options: Options

  /*
  public getSuppression(): amd.Suppression | undefined {
    return this.suppression
  }
  */

  /*
   * @constructor
   * Initializes a new instance of the SpecValidator class.
   *
   * @param {string} specPath the (remote|local) swagger spec path
   *
   * @param {object} [specInJson] the parsed spec in json format
   *
   * @param {object} [options.shouldResolveRelativePaths] Should relative paths be resolved?
   * Default: true
   *
   * @param {object} [options.shouldResolveXmsExamples] Should x-ms-examples be resolved?
   * Default: true.
   * If options.shouldResolveRelativePaths is false then this option will also be false implicitly
   * and cannot be overridden.
   *
   * @param {object} [options.shouldResolveAllOf] Should allOf references be resolved? Default: true
   *
   * @param {object} [options.shouldResolveDiscriminator] Should discriminator be resolved?
   * Default: true
   *
   * @param {object} [options.shouldSetAdditionalPropertiesFalse] Should additionalProperties be
   * set to false? Default: true
   *
   * @param {object} [options.shouldResolvePureObjects] Should pure objects be resolved?
   * Default: true
   *
   * @param {object} [options.shouldResolveParameterizedHost] Should 'x-ms-parameterized-host' be
   * resolved? Default: true
   *
   * @param {object} [options.shouldResolveNullableTypes] Should we allow null values to match any
   * type? Default: true
   *
   * @param {object} [options.isPathCaseSensitive] Specifies if the paths should be considered case
   * sensitive. Default: true
   *
   * @return {object} An instance of the SpecValidator class.
   */
  public constructor(
    specPath: string,
    specInJson: SwaggerObject | undefined | null | string,
    options: Options
  ) {
    if (specPath === null
      || specPath === undefined
      || typeof specPath.valueOf() !== "string"
      || !specPath.trim().length) {
      throw new Error(
        "specPath is a required parameter of type string and it cannot be an empty string.")
    }
    // If the spec path is a url starting with https://github then let us auto convert it to an
    // https://raw.githubusercontent url.
    if (specPath.startsWith("https://github")) {
      specPath = specPath.replace(
        /^https:\/\/(github.com)(.*)blob\/(.*)/ig, "https://raw.githubusercontent.com$2$3")
    }
    this.specPath = specPath
    this.specDir = path.dirname(this.specPath)
    this.specInJson = specInJson as SwaggerObject
    this.specResolver = null
    const base: CommonValidationResult = { validityStatus: true, operations: {} }
    this.specValidationResult = base as T
    if (!options) { options = {} }
    if (options.shouldResolveRelativePaths === null
      || options.shouldResolveRelativePaths === undefined) {
      options.shouldResolveRelativePaths = true
    }

    this.options = options
  }

  /*
   * Initializes the spec validator. Resolves the spec on different counts using the SpecResolver
   * and initializes the internal api validator.
   */
  public async initialize(): Promise<Sway.SwaggerApi> {
    if (this.options.shouldResolveRelativePaths) {
      utils.clearCache()
    }
    try {
      let suppression: amd.Suppression | undefined
      if (this.specInJson === undefined || this.specInJson === null) {
        suppression = await getSuppressions(this.specPath)
        const result = await utils.parseJson(suppression, this.specPath)
        this.specInJson = result
      }

      this.specResolver = new SpecResolver(this.specPath, this.specInJson, this.options)
      this.specInJson = (await this.specResolver.resolve(suppression)).specInJson

      const options = {
        definition: this.specInJson,
        jsonRefs: {
          relativeBase: this.specDir
        },
        isPathCaseSensitive: this.options.isPathCaseSensitive
      }
      this.swaggerApi = await Sway.create(options)
      return this.swaggerApi
    } catch (err) {
      const e = this.constructErrorObject(ErrorCodes.ResolveSpecError, err.message, [err])
      this.specValidationResult.resolveSpec = e
      log.error(`${ErrorCodes.ResolveSpecError.name}: ${err.message}.`)
      log.error(err.stack)
      throw e
    }
  }

  /*
   * Constructs the Error object and updates the validityStatus unless indicated to not update the
   * status.
   *
   * @param {string} code The Error code that uniquely identifiers the error.
   *
   * @param {string} message The message that provides more information about the error.
   *
   * @param {array} [innerErrors] An array of Error objects that specify inner details.
   *
   * @param {boolean} [skipValidityStatusUpdate] When specified a truthy value it will skip updating
   *    the validity status.
   *
   * @return {object} err Return the constructed Error object.
   */
  protected constructErrorObject<TE extends CommonError>(
    code: ErrorCode,
    message: string,
    innerErrors?: null | TE[],
    skipValidityStatusUpdate?: boolean
  ): TE {

    const err: CommonError = {
      code: code.name,
      id: code.id,
      message: message
    }
    setMutableProperty(err, "innerErrors", innerErrors ? innerErrors : undefined)
    if (!skipValidityStatusUpdate) {
      this.updateValidityStatus()
    }
    return err as TE
  }

  /*
   * Updates the validityStatus of the internal specValidationResult based on the provided value.
   *
   * @param {boolean} value
   */
  protected updateValidityStatus(value?: boolean): void {
    this.specValidationResult.validityStatus = Boolean(value)
  }
}
