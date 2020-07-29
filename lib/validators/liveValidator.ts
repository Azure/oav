// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as http from "http";
import * as os from "os";
import * as path from "path";
import * as url from "url";
import * as util from "util";

import { ParsedUrlQuery } from "querystring";
import { JSONPath } from "jsonpath-plus";
import { MutableStringMap } from "@ts-common/string-map";
import * as _ from "lodash";
import { ValidateFunction } from "ajv";
import globby from "globby";
import { ajvErrorCodeToOavErrorCode } from "../swagger/swaggerLiveValidatorErrors";
import { Severity } from "../util/severity";
import { Operation, SwaggerSpec } from "../swagger/swaggerTypes";
import {
  LiveRequest,
  LiveResponse,
  OperationContext,
  OperationMatch,
  ValidationRequest,
  validateSwaggerLiveRequest,
  validateSwaggerLiveResponse,
} from "../swagger/swaggerLiveValidator";
import {
  ExtendedErrorCode,
  RuntimeException,
  SourceLocation,
  errorCodeToErrorMetadata,
} from "../util/validationError";
import * as utils from "../util/utils";
import * as models from "../models";
import { SwaggerLiveValidatorLoader } from "../swagger/swaggerLiveValidatorLoader";
import * as C from "../util/constants";
import { log } from "../util/logging";
import { requestResponseDefinition } from "../models/requestResponse";
import { SwaggerValidator } from "./swaggerValidator";

export interface LiveValidatorOptions {
  swaggerPaths: string[];
  git: {
    shouldClone: boolean;
    url?: string;
    branch?: string;
  };
  useRelativeSourceLocationUrl?: boolean;
  directory: string;
  swaggerPathsPattern: string[];
  excludedSwaggerPathsPattern: string[];
  isPathCaseSensitive: boolean;
  loadValidatorInBackground: boolean;
  loadValidatorInInitialize: boolean;
}

interface ApiVersion {
  [method: string]: Operation[];
}

interface Provider {
  [apiVersion: string]: ApiVersion;
}

interface PotentialOperationsResult {
  readonly operations: OperationMatch[];
  readonly resourceProvider: string;
  readonly apiVersion: string;
  readonly reason?: models.LiveValidationError;
}

export interface RequestResponsePair {
  readonly liveRequest: LiveRequest;
  readonly liveResponse: LiveResponse;
}

export interface LiveValidationResult {
  readonly isSuccessful?: boolean;
  readonly operationInfo: OperationContext;
  readonly errors: LiveValidationIssue[];
  readonly runtimeException?: RuntimeException;
}

export interface RequestResponseLiveValidationResult {
  readonly requestValidationResult: LiveValidationResult;
  readonly responseValidationResult: LiveValidationResult;
  readonly runtimeException?: RuntimeException;
}

export interface ApiOperationIdentifier {
  readonly url: string;
  readonly method: string;
}

export interface LiveValidationIssue {
  code: ExtendedErrorCode;
  readonly message: string;
  readonly jsonPathsInPayload: string[];
  readonly pathsInPayload: string[];
  readonly schemaPath: string;
  readonly severity: Severity;
  readonly source: SourceLocation;
  readonly documentationUrl?: string;
  readonly params?: any;
  readonly inner?: LiveValidationIssue[];
}

/**
 * Additional data to log.
 */
interface Meta {
  [key: string]: any;
}

/**
 * Options for a validation operation.
 * If `includeErrors` is missing or empty, all error codes will be included.
 */
export interface ValidateOptions {
  readonly includeErrors?: ExtendedErrorCode[];
  readonly includeOperationMatch?: boolean;
}

enum LiveValidatorLoggingLevels {
  error = "error",
  warn = "warn",
  info = "info",
  verbose = "verbose",
  debug = "debug",
  silly = "silly",
}

/**
 * @class
 * Live Validator for Azure swagger APIs.
 */
export class LiveValidator {
  public readonly cache: MutableStringMap<Provider> = {};

  public options: LiveValidatorOptions;

  private logFunction?: (message: string, level: string, meta?: Meta) => void;

  private loader?: SwaggerLiveValidatorLoader;

  private loadInBackgroundComplete: boolean = false;

  private validateRequestResponsePair?: ValidateFunction;

  /**
   * Constructs LiveValidator based on provided options.
   *
   * @param {object} ops The configuration options.
   * @param {callback function} logCallback The callback logger.
   *
   * @returns CacheBuilder Returns the configured CacheBuilder object.
   */
  public constructor(
    options?: Partial<LiveValidatorOptions>,
    logCallback?: (message: string, level: string, meta?: Meta) => void
  ) {
    const ops: Partial<LiveValidatorOptions> = options || {};
    this.logFunction = logCallback;

    if (!ops.swaggerPaths) {
      ops.swaggerPaths = [];
    }

    if (!ops.excludedSwaggerPathsPattern) {
      ops.excludedSwaggerPathsPattern = C.DefaultConfig.ExcludedSwaggerPathsPattern;
    }

    if (!ops.git) {
      ops.git = {
        url: "https://github.com/Azure/azure-rest-api-specs.git",
        shouldClone: false,
      };
    }

    if (!ops.git.url) {
      ops.git.url = "https://github.com/Azure/azure-rest-api-specs.git";
    }
    if (!ops.git.shouldClone) {
      ops.git.shouldClone = false;
    }

    if (!ops.directory) {
      ops.directory = path.resolve(os.homedir(), "repo");
    }

    if (!ops.isPathCaseSensitive) {
      ops.isPathCaseSensitive = false;
    }

    if (ops.loadValidatorInBackground === undefined) {
      ops.loadValidatorInBackground = true;
    }

    if (ops.loadValidatorInInitialize === undefined) {
      ops.loadValidatorInInitialize = false;
    }

    this.options = ops as LiveValidatorOptions;
  }

  /**
   * Initializes the Live Validator.
   */
  public async initialize(): Promise<void> {
    const startTime = Date.now();
    // Clone github repository if required
    if (this.options.git.shouldClone && this.options.git.url) {
      utils.gitClone(this.options.directory, this.options.git.url, this.options.git.branch);
    }

    // Construct array of swagger paths to be used for building a cache
    this.logging("Get swagger path.");
    const swaggerPaths = await this.getSwaggerPaths();
    this.loader = new SwaggerLiveValidatorLoader(this.options.directory, {
      transformToNewSchemaFormat: false,
    });
    this.validateRequestResponsePair = this.loader.ajv.compile(requestResponseDefinition);

    const allSpecs: SwaggerSpec[] = [];
    while (swaggerPaths.length > 0) {
      const swaggerPath = swaggerPaths.shift()!;
      const spec = await this.getSwaggerInitializer(this.loader!, swaggerPath);
      if (spec !== undefined) {
        allSpecs.push(spec);
      }
    }

    this.logging("Transforming all specs.");
    this.loader.transformLoadedSpecs();

    if (this.options.loadValidatorInInitialize) {
      while (allSpecs.length > 0) {
        const spec = allSpecs.shift()!;
        const loadStart = Date.now();
        await this.loader.buildAjvValidator(spec);
        this.logging(
          `Build validator for ${spec._filePath} with DurationInMs:${Date.now() - loadStart}.`,
          LiveValidatorLoggingLevels.info,
          "Oav.liveValidator.initialize"
        );
      }

      this.loader = undefined;
    }

    this.logging("Cache initialization complete.");
    const elapsedTime = Date.now() - startTime;
    this.logging(
      `Cache initialization complete with DurationInMs:${elapsedTime}.`,
      LiveValidatorLoggingLevels.info,
      "Oav.liveValidator.initialize"
    );

    if (this.options.loadValidatorInBackground) {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.loadAllSpecValidatorInBackground(allSpecs);
    }
  }

  public isLoadInBackgroundCompleted() {
    return this.loadInBackgroundComplete;
  }

  private async loadAllSpecValidatorInBackground(allSpecs: SwaggerSpec[]) {
    const backgroundStartTime = Date.now();
    utils.shuffleArray(allSpecs);
    while (allSpecs.length > 0) {
      const spec = allSpecs.shift()!;
      const startTime = Date.now();
      await this.loader!.buildAjvValidator(spec, { inBackground: true });
      this.logging(
        `Build validator for ${spec._filePath} in background with DurationInMs:${
          Date.now() - startTime
        }.`,
        LiveValidatorLoggingLevels.info,
        "Oav.liveValidator.initialize"
      );
    }

    this.loader = undefined;
    this.loadInBackgroundComplete = true;
    this.logging(
      `Build validator for all specs finished in background with DurationInMs:${
        Date.now() - backgroundStartTime
      }.`,
      LiveValidatorLoggingLevels.info,
      "Oav.liveValidator.initialize"
    );
  }

  /**
   *  Validates live request.
   */
  public async validateLiveRequest(
    liveRequest: LiveRequest,
    options: ValidateOptions = {},
    operationInfo?: OperationContext
  ): Promise<LiveValidationResult> {
    const startTime = Date.now();
    const correlationId = liveRequest.headers?.["x-ms-correlation-request-id"] || "";
    const { info, error } = this.getOperationInfo(liveRequest, correlationId, operationInfo);
    if (error !== undefined) {
      this.logging(
        error.message,
        LiveValidatorLoggingLevels.error,
        "Oav.liveValidator.validateLiveRequest",
        info.validationRequest
      );
      return {
        isSuccessful: undefined,
        errors: [],
        runtimeException: error,
        operationInfo: info,
      };
    }
    if (!liveRequest.query) {
      liveRequest.query = url.parse(liveRequest.url, true).query;
    }
    let errors: LiveValidationIssue[] = [];
    let runtimeException;
    try {
      errors = await validateSwaggerLiveRequest(
        liveRequest,
        info,
        this.loader,
        options.includeErrors
      );
    } catch (reqValidationError) {
      const msg =
        `An error occurred while validating the live request for operation ` +
        `"${info.operationId}". The error is:\n ` +
        `${util.inspect(reqValidationError, { depth: null })}`;
      runtimeException = { code: C.ErrorCodes.RequestValidationError.name, message: msg };
      this.logging(
        msg,
        LiveValidatorLoggingLevels.error,
        "Oav.liveValidator.validateLiveRequest",
        info.validationRequest
      );
    }
    const elapsedTime = Date.now() - startTime;
    this.logging(
      `DurationInMs:${elapsedTime}`,
      LiveValidatorLoggingLevels.debug,
      "Oav.liveValidator.validateLiveRequest",
      info.validationRequest
    );
    if (!options.includeOperationMatch) {
      delete info.operationMatch;
      delete info.validationRequest;
    }
    return {
      isSuccessful: runtimeException ? undefined : errors.length === 0,
      operationInfo: info,
      errors,
      runtimeException,
    };
  }

  private toLiveValidationIssue(err: { [index: string]: any; url: string }): LiveValidationIssue {
    return {
      code: err.code || "INTERNAL_ERROR",
      message: err.message || "",
      jsonPathsInPayload: err.jsonPath ? [err.jsonPath, ...(err.similarJsonPaths || [])] : [],
      pathsInPayload: err.path ? [err.path, ...(err.similarPaths || [])] : [],
      schemaPath: err.schemaPath || "",
      inner: Array.isArray(err.inner)
        ? err.inner.map((innerErr) => this.toLiveValidationIssue(innerErr))
        : undefined,
      severity: errorCodeToErrorMetadata(err.code).severity,
      params: err.params || undefined,
      source: {
        url:
          this.options.useRelativeSourceLocationUrl && err.url
            ? err.url.substr(this.options.directory.length)
            : err.url,
        jsonRef: err.title || "",
        position: {
          column: err.position ? err.position.column : -1,
          line: err.position ? err.position.line : -1,
        },
      },
      documentationUrl: errorCodeToErrorMetadata(err.code).docUrl,
    };
  }

  /**
   * Validates live response.
   */
  public async validateLiveResponse(
    liveResponse: LiveResponse,
    specOperation: ApiOperationIdentifier,
    options: ValidateOptions = {},
    operationInfo?: OperationContext
  ): Promise<LiveValidationResult> {
    const startTime = Date.now();
    const correlationId = liveResponse.headers?.["x-ms-correlation-request-id"] || "";
    const { info, error } = this.getOperationInfo(specOperation, correlationId, operationInfo);
    if (error !== undefined) {
      this.logging(
        error.message,
        LiveValidatorLoggingLevels.error,
        "Oav.liveValidator.validateLiveResponse",
        info.validationRequest
      );
      return {
        isSuccessful: undefined,
        errors: [],
        runtimeException: error,
        operationInfo: { apiVersion: C.unknownApiVersion, operationId: C.unknownOperationId },
      };
    }
    let errors: LiveValidationIssue[] = [];
    let runtimeException;
    // If status code is passed as a status code string (e.g. "OK") transform it to the status code
    // number (e.g. '200').
    if (
      !http.STATUS_CODES[liveResponse.statusCode] &&
      utils.statusCodeStringToStatusCode[liveResponse.statusCode.toLowerCase()]
    ) {
      liveResponse.statusCode =
        utils.statusCodeStringToStatusCode[liveResponse.statusCode.toLowerCase()];
    }
    try {
      errors = await validateSwaggerLiveResponse(
        liveResponse,
        info,
        this.loader,
        options.includeErrors
      );
    } catch (resValidationError) {
      const msg =
        `An error occurred while validating the live response for operation ` +
        `"${info.operationId}". The error is:\n ` +
        `${util.inspect(resValidationError, { depth: null })}`;
      runtimeException = { code: C.ErrorCodes.RequestValidationError.name, message: msg };
      this.logging(
        msg,
        LiveValidatorLoggingLevels.error,
        "Oav.liveValidator.validateLiveResponse",
        info.validationRequest
      );
    }
    const elapsedTime = Date.now() - startTime;
    this.logging(
      `DurationInMs:${elapsedTime}`,
      LiveValidatorLoggingLevels.debug,
      "Oav.liveValidator.validateLiveResponse",
      info.validationRequest
    );
    if (!options.includeOperationMatch) {
      delete info.operationMatch;
      delete info.validationRequest;
    }
    return {
      isSuccessful: runtimeException ? undefined : errors.length === 0,
      operationInfo: info,
      errors,
      runtimeException,
    };
  }

  /**
   * Validates live request and response.
   */
  public async validateLiveRequestResponse(
    requestResponseObj: RequestResponsePair,
    options?: ValidateOptions
  ): Promise<RequestResponseLiveValidationResult> {
    const validationResult = {
      requestValidationResult: {
        errors: [],
        operationInfo: { apiVersion: C.unknownApiVersion, operationId: C.unknownOperationId },
      },
      responseValidationResult: {
        errors: [],
        operationInfo: { apiVersion: C.unknownApiVersion, operationId: C.unknownOperationId },
      },
    };
    if (!requestResponseObj) {
      const message =
        'requestResponseObj cannot be null or undefined and must be of type "object".';
      return {
        ...validationResult,
        runtimeException: {
          code: C.ErrorCodes.IncorrectInput.name,
          message,
        },
      };
    }

    const validate = this.validateRequestResponsePair!;
    if (!validate(requestResponseObj)) {
      const ajvErr = validate.errors![0];
      const errInfo = ajvErrorCodeToOavErrorCode(
        ajvErr,
        (JSONPath as any).toPathArray(ajvErr.dataPath),
        ajvErr.dataPath,
        { isResponse: false }
      );
      const message =
        `Found errors "${errInfo?.message}" in the provided input in path ${ajvErr.dataPath}:\n` +
        `${util.inspect(requestResponseObj, { depth: null })}.`;
      return {
        ...validationResult,
        runtimeException: {
          code: C.ErrorCodes.IncorrectInput.name,
          message,
        },
      };
    }

    const request = requestResponseObj.liveRequest;
    const response = requestResponseObj.liveResponse;

    const requestValidationResult = await this.validateLiveRequest(request, {
      ...options,
      includeOperationMatch: true,
    });
    const info = requestValidationResult.operationInfo;
    const responseValidationResult =
      requestValidationResult.isSuccessful === undefined &&
      requestValidationResult.runtimeException === undefined
        ? requestValidationResult
        : await this.validateLiveResponse(
            response,
            {
              method: request.method,
              url: request.url,
            },
            {
              ...options,
              includeOperationMatch: false,
            },
            info
          );

    delete info.validationRequest;
    delete info.operationMatch;

    return {
      requestValidationResult,
      responseValidationResult,
    };
  }

  private getOperationInfo(
    request: { url: string; method: string },
    correlationId: string,
    operationInfo?: OperationContext
  ): {
    info: OperationContext;
    error?: any;
  } {
    const info = operationInfo ?? {
      apiVersion: C.unknownApiVersion,
      operationId: C.unknownOperationId,
    };
    try {
      if (info.validationRequest === undefined) {
        info.validationRequest = this.parseValidationRequest(
          request.url,
          request.method,
          correlationId
        );
      }
      if (info.operationMatch === undefined) {
        const result = this.findSpecOperation(info.validationRequest);
        info.apiVersion = result.apiVersion;
        info.operationMatch = result.operationMatch;
      }
      info.operationId = info.operationMatch.operation.operationId!;
      return { info };
    } catch (error) {
      return { info, error };
    }
  }

  /**
   * Gets list of potential operations objects for given url and method.
   *
   * @param  requestInfo The parsed request info for which to find potential operations.
   *
   * @returns Potential operation result object.
   */
  private getPotentialOperations(requestInfo: ValidationRequest): PotentialOperationsResult {
    const startTime = Date.now();
    if (_.isEmpty(this.cache)) {
      const msgStr =
        `Please call "liveValidator.initialize()" before calling this method, ` +
        `so that cache is populated.`;
      throw new Error(msgStr);
    }

    let potentialOperations: OperationMatch[] = [];
    let msg;
    let code;
    let liveValidationError: models.LiveValidationError | undefined;
    if (requestInfo.pathStr === "") {
      msg = `Could not find path from requestUrl: "${requestInfo.requestUrl}".`;
      liveValidationError = new models.LiveValidationError(
        C.ErrorCodes.PathNotFoundInRequestUrl.name,
        msg
      );
      return {
        operations: potentialOperations,
        resourceProvider: C.unknownResourceProvider,
        apiVersion: C.unknownApiVersion,
        reason: liveValidationError,
      };
    }

    // Search using provider
    const allApiVersions = this.cache[requestInfo.providerNamespace];
    if (allApiVersions) {
      // Search using api-version found in the requestUrl
      if (requestInfo.apiVersion) {
        const allMethods = allApiVersions[requestInfo.apiVersion];
        if (allMethods) {
          const operationsForHttpMethod = allMethods[requestInfo.requestMethod];
          // Search using requestMethod provided by user
          if (operationsForHttpMethod) {
            // Find the best match using regex on path
            potentialOperations = this.getPotentialOperationsHelper(
              requestInfo,
              operationsForHttpMethod
            );
            // If potentialOperations were to be [] then we need reason
            msg =
              `Could not find best match operation for verb "${requestInfo.requestMethod}" for api-version ` +
              `"${requestInfo.apiVersion}" and provider "${requestInfo.providerNamespace}" in the cache.`;
            code = C.ErrorCodes.OperationNotFoundInCache;
          } else {
            msg =
              `Could not find any methods with verb "${requestInfo.requestMethod}" for api-version ` +
              `"${requestInfo.apiVersion}" and provider "${requestInfo.providerNamespace}" in the cache.`;
            code = C.ErrorCodes.OperationNotFoundInCacheWithVerb;
            this.logging(
              `${msg} with requestUrl ${requestInfo.requestUrl}`,
              LiveValidatorLoggingLevels.debug,
              "Oav.liveValidator.getPotentialOperations",
              requestInfo
            );
          }
        } else {
          msg =
            `Could not find exact api-version "${requestInfo.apiVersion}" for provider "${requestInfo.providerNamespace}" ` +
            `in the cache.`;
          code = C.ErrorCodes.OperationNotFoundInCacheWithApi;
          this.logging(
            `${msg} with requestUrl ${requestInfo.requestUrl}, we'll search in the resource provider "Microsoft.Unknown".`,
            LiveValidatorLoggingLevels.debug,
            "Oav.liveValidator.getPotentialOperations",
            requestInfo
          );
          potentialOperations = this.getPotentialOperationsHelper(requestInfo, []);
        }
      } else {
        msg = `Could not find api-version in requestUrl "${requestInfo.requestUrl}".`;
        code = C.ErrorCodes.OperationNotFoundInCacheWithApi;
        this.logging(
          `${msg} with requestUrl ${requestInfo.requestUrl}`,
          LiveValidatorLoggingLevels.debug,
          "Oav.liveValidator.getPotentialOperations",
          requestInfo
        );
      }
    } else {
      // provider does not exist in cache
      msg = `Could not find provider "${requestInfo.providerNamespace}" in the cache.`;
      code = C.ErrorCodes.OperationNotFoundInCacheWithProvider;
      this.logging(
        `${msg} with requestUrl ${requestInfo.requestUrl}, we'll search in the resource provider "Microsoft.Unknown".`,
        LiveValidatorLoggingLevels.debug,
        "Oav.liveValidator.getPotentialOperations",
        requestInfo
      );
      potentialOperations = this.getPotentialOperationsHelper(requestInfo, []);
    }

    // Provide reason when we do not find any potential operation in cache
    if (potentialOperations.length === 0) {
      liveValidationError = new models.LiveValidationError(code.name, msg);
    }
    const elapsedTime = Date.now() - startTime;
    this.logging(
      `DurationInMs:${elapsedTime}`,
      LiveValidatorLoggingLevels.debug,
      "Oav.liveValidator.getPotentialOperations",
      requestInfo
    );

    return {
      operations: potentialOperations,
      resourceProvider: requestInfo.providerNamespace,
      apiVersion: requestInfo.apiVersion,
      reason: liveValidationError,
    };
  }

  /**
   * Parse the validation request information.
   *
   * @param  requestUrl The url of service api call.
   *
   * @param requestMethod The http verb for the method to be used for lookup.
   *
   * @param correlationId The id to correlate the api calls.
   *
   * @returns parsed ValidationRequest info.
   */
  public parseValidationRequest(
    requestUrl: string,
    requestMethod: string,
    correlationId: string
  ): ValidationRequest {
    if (
      requestUrl === undefined ||
      requestUrl === null ||
      typeof requestUrl.valueOf() !== "string" ||
      !requestUrl.trim().length
    ) {
      const msg =
        "An error occurred while trying to parse validation payload." +
        'requestUrl is a required parameter of type "string" and it cannot be an empty string.';
      const e = new models.LiveValidationError(
        C.ErrorCodes.PotentialOperationSearchError.name,
        msg
      );
      throw e;
    }

    if (
      requestMethod === undefined ||
      requestMethod === null ||
      typeof requestMethod.valueOf() !== "string" ||
      !requestMethod.trim().length
    ) {
      const msg =
        "An error occurred while trying to parse validation payload." +
        'requestMethod is a required parameter of type "string" and it cannot be an empty string.';
      const e = new models.LiveValidationError(
        C.ErrorCodes.PotentialOperationSearchError.name,
        msg
      );
      throw e;
    }
    let queryStr;
    let apiVersion = "";
    let resourceType = "";
    let providerNamespace = "";

    const parsedUrl = url.parse(requestUrl, true);
    const pathStr = parsedUrl.pathname || "";
    if (pathStr !== "") {
      // Lower all the keys and values of query parameters before searching for `api-version`
      const queryObject = _.transform(
        parsedUrl.query,
        (obj: ParsedUrlQuery, value, key) =>
          (obj[key.toLowerCase()] = _.isString(value) ? value.toLowerCase() : value)
      );
      apiVersion = queryObject["api-version"] as string;
      providerNamespace = utils.getProvider(pathStr) || C.unknownResourceProvider;
      resourceType = utils.getResourceType(pathStr, providerNamespace);

      // Provider would be provider found from the path or Microsoft.Unknown
      providerNamespace = providerNamespace || C.unknownResourceProvider;
      if (providerNamespace === C.unknownResourceProvider) {
        apiVersion = C.unknownApiVersion;
      }
      providerNamespace = providerNamespace.toLowerCase();
      apiVersion = apiVersion.toLowerCase();
      queryStr = queryObject;
      requestMethod = requestMethod.toLowerCase();
    }
    return {
      providerNamespace,
      resourceType,
      apiVersion,
      requestMethod,
      pathStr,
      queryStr,
      correlationId,
      requestUrl,
    };
  }

  /**
   * Gets list of matched operations objects for given url.
   *
   * @param {string} requestUrl The url for which to find matched operations.
   *
   * @param {Array<Operation>} operations The list of operations to search.
   *
   * @returns {Array<Operation>} List of matched operations with the request url.
   */
  private getMatchedOperations(
    requestUrl: string,
    operations: Operation[],
    query?: ParsedUrlQuery
  ): OperationMatch[] {
    const result: OperationMatch[] = [];
    const queryMatchResult: OperationMatch[] = [];

    for (const operation of operations) {
      const path = operation._path;
      // Validate query first so we could match operation in x-ms-paths
      const queryMatch = path._validateQuery === undefined ? undefined : path._validateQuery(query);
      if (queryMatch === false) {
        continue;
      }

      const pathMatch = path._pathRegex.exec(requestUrl);
      if (pathMatch === null) {
        continue;
      }

      (queryMatch === undefined ? result : queryMatchResult).push({
        operation,
        pathRegex: path._pathRegex,
        pathMatch: pathMatch,
      });
    }

    return queryMatchResult.length === 0 ? result : queryMatchResult;
  }

  /**
   * Gets list of potential operations objects for given path and method.
   *
   * @param {string} requestPath The path of the url for which to find potential operations.
   *
   * @param {string} requestMethod The http verb for the method to be used for lookup.
   *
   * @param {Array<Operation>} operations The list of operations to search.
   *
   * @returns {Array<Operation>} List of potential operations matching the requestPath.
   */
  private getPotentialOperationsHelper(
    requestInfo: ValidationRequest,
    operations: Operation[]
  ): OperationMatch[] {
    const startTime = Date.now();
    if (operations === null || operations === undefined || !Array.isArray(operations)) {
      throw new Error('operations is a required parameter of type "array".');
    }

    let requestUrl = formatUrlToExpectedFormat(requestInfo.pathStr);
    let potentialOperations = this.getMatchedOperations(
      requestUrl,
      operations,
      requestInfo.queryStr
    );

    // fall back to the last child resource url to search for operations
    // if there're no matched operations for found for the whole url
    if (!potentialOperations.length) {
      requestUrl = utils.getLastResourceUrlToMatch(requestUrl);
      potentialOperations = this.getMatchedOperations(requestUrl, operations, requestInfo.queryStr);
    }

    // If we do not find any match then we'll look into Microsoft.Unknown -> unknown-api-version
    // for given requestMethod as the fall back option
    if (!potentialOperations.length) {
      const ops = this.cache[C.unknownResourceProvider]?.[requestInfo.apiVersion]?.[
        requestInfo.requestMethod
      ];
      if (ops !== undefined) {
        potentialOperations = this.getMatchedOperations(
          requestInfo.pathStr,
          operations,
          requestInfo.queryStr
        );
      }
    }
    const elapsedTime = Date.now() - startTime;
    this.logging(
      `DurationInMs:${elapsedTime}`,
      LiveValidatorLoggingLevels.debug,
      "Oav.liveValidator.getPotentialOperationsHelper",
      requestInfo
    );

    return potentialOperations;
  }

  /**
   * Gets the swagger operation based on the HTTP url and method
   */
  private findSpecOperation(
    requestInfo: ValidationRequest
  ): {
    operationMatch: OperationMatch;
    apiVersion: string;
  } {
    let potentialOperationsResult;
    try {
      potentialOperationsResult = this.getPotentialOperations(requestInfo);
    } catch (err) {
      const msg =
        `An error occurred while trying to search for potential operations:\n` +
        `${util.inspect(err, { depth: null })}`;
      const e = new models.LiveValidationError(
        C.ErrorCodes.PotentialOperationSearchError.name,
        msg
      );
      throw e;
    }

    // Found empty potentialOperations
    if (potentialOperationsResult.operations.length === 0) {
      throw potentialOperationsResult.reason;
      // Found more than 1 potentialOperations
    } else if (potentialOperationsResult.operations.length > 1) {
      const operationInfos: Array<{ id: string; path: string; specPath: string }> = [];

      potentialOperationsResult.operations.forEach(({ operation }) => {
        const specPath = operation._path._spec._filePath;
        const swaggerSpecPath =
          this.options.useRelativeSourceLocationUrl && specPath
            ? specPath.substr(this.options.directory.length)
            : specPath;
        operationInfos.push({
          id: operation.operationId!,
          path: operation._path._pathTemplate,
          specPath: swaggerSpecPath,
        });
      });

      const msg =
        `Found multiple matching operations ` +
        `for request url "${requestInfo.requestUrl}" with HTTP Method "${requestInfo.requestMethod}".` +
        `Operation Information: ${JSON.stringify(operationInfos)}`;
      this.logging(
        msg,
        LiveValidatorLoggingLevels.debug,
        "Oav.liveValidator.findSpecOperation",
        requestInfo
      );
      const e = new models.LiveValidationError(C.ErrorCodes.MultipleOperationsFound.name, msg);
      throw e;
    }

    return {
      operationMatch: potentialOperationsResult.operations[0],
      apiVersion: potentialOperationsResult.apiVersion,
    };
  }

  private async getMatchedPaths(jsonsPattern: string | string[]): Promise<string[]> {
    const matchedPaths = await globby(jsonsPattern, {
      ignore: this.options.excludedSwaggerPathsPattern,
      onlyFiles: true,
      unique: true,
    });
    this.logging(
      `Using swaggers found from directory: "${
        this.options.directory
      }" and pattern: "${jsonsPattern.toString()}".
      Total paths count: ${matchedPaths.length}`,
      LiveValidatorLoggingLevels.debug
    );
    return matchedPaths;
  }

  private async getSwaggerPaths(): Promise<string[]> {
    if (this.options.swaggerPaths.length !== 0) {
      this.logging(
        `Using user provided swagger paths. Total paths count: ${this.options.swaggerPaths.length}`
      );
      return this.options.swaggerPaths;
    } else {
      const allJsonsPattern = path.join(this.options.directory, "/specification/**/*.json");
      const swaggerPathPatterns: string[] = [];
      if (
        this.options.swaggerPathsPattern === undefined ||
        this.options.swaggerPathsPattern.length === 0
      ) {
        return this.getMatchedPaths(allJsonsPattern);
      } else {
        this.options.swaggerPathsPattern.map((item) => {
          swaggerPathPatterns.push(path.join(this.options.directory, item));
        });
        return this.getMatchedPaths(swaggerPathPatterns);
      }
    }
  }

  private async getSwaggerInitializer(
    loader: SwaggerLiveValidatorLoader,
    swaggerPath: string
  ): Promise<SwaggerSpec | undefined> {
    const startTime = Date.now();
    this.logging(`Building cache from: "${swaggerPath}"`, LiveValidatorLoggingLevels.debug);

    const validator = new SwaggerValidator(swaggerPath, {
      isPathCaseSensitive: this.options.isPathCaseSensitive,
      shouldResolveXmsExamples: false,
      loadSuppression: false,
    });

    try {
      const startTimeLoadSpec = Date.now();
      const spec = await validator.initialize(loader);
      const elapsedTimeLoadSpec = Date.now() - startTimeLoadSpec;
      this.logging(
        `Load spec for ${swaggerPath} with DurationInMs:${elapsedTimeLoadSpec}`,
        LiveValidatorLoggingLevels.info,
        "Oav.liveValidator.getSwaggerInitializer.specValidator.initialize"
      );

      loader.traverseSwagger(spec, {
        onOperation: (operation, path, method) => {
          const httpMethod = method.toLowerCase();
          const pathObject = path;
          const pathStr = pathObject._pathTemplate;
          let apiVersion = spec.info.version;
          let provider = utils.getProvider(pathStr);
          this.logging(
            `${apiVersion}, ${operation.operationId}, ${pathStr}, ${httpMethod}`,
            LiveValidatorLoggingLevels.debug
          );

          if (!provider) {
            const title = spec.info.title;

            // Whitelist lookups: Look up knownTitleToResourceProviders
            // Putting the provider namespace onto operation for future use
            if (title && C.knownTitleToResourceProviders[title]) {
              operation.provider = C.knownTitleToResourceProviders[title];
            }

            // Put the operation into 'Microsoft.Unknown' RPs
            provider = C.unknownResourceProvider;
            this.logging(
              `Unable to find provider for path : "${pathObject._pathTemplate}". ` +
                `Bucketizing into provider: "${provider}"`,
              LiveValidatorLoggingLevels.debug
            );
          }
          provider = provider.toLowerCase();

          if (!apiVersion) {
            this.logging(
              `Unable to find apiVersion for path : "${pathObject._pathTemplate}".`,
              LiveValidatorLoggingLevels.error
            );
            apiVersion = C.unknownApiVersion;
          }
          apiVersion = apiVersion.toLowerCase();

          // Get all api-version for given provider or initialize it
          const apiVersions = this.cache[provider] || {};
          // Get methods for given apiVersion or initialize it
          const allMethods = apiVersions[apiVersion] || {};
          // Get specific http methods array for given verb or initialize it
          const operationsForHttpMethod = allMethods[httpMethod] || [];

          // Builds the cache
          operationsForHttpMethod.push(operation);
          allMethods[httpMethod] = operationsForHttpMethod;
          apiVersions[apiVersion] = allMethods;
          this.cache[provider] = apiVersions;
        },
      });
      const elapsedTime = Date.now() - startTime;
      this.logging(
        `DurationInMs:${elapsedTime}`,
        LiveValidatorLoggingLevels.debug,
        "Oav.liveValidator.getSwaggerInitializer"
      );

      return spec;
    } catch (err) {
      // Do Not reject promise in case, we cannot initialize one of the swagger
      this.logging(
        `Unable to initialize "${swaggerPath}" file from SpecValidator. Error: ${err}`,
        LiveValidatorLoggingLevels.debug
      );
      this.logging(
        `Unable to initialize "${swaggerPath}" file from SpecValidator. We are ` +
          `ignoring this swagger file and continuing to build cache for other valid specs.`,
        LiveValidatorLoggingLevels.warn
      );

      return undefined;
    }
  }

  private logging(
    message: string,
    level?: LiveValidatorLoggingLevels,
    operationName?: string,
    validationRequest?: ValidationRequest
  ): void {
    level = level || LiveValidatorLoggingLevels.info;
    operationName = operationName || "";
    if (this.logFunction !== undefined) {
      if (validationRequest !== undefined && validationRequest !== null) {
        this.logFunction(message, level, {
          CorrelationId: validationRequest.correlationId,
          ProviderNamespace: validationRequest.providerNamespace,
          ResourceType: validationRequest.resourceType,
          ApiVersion: validationRequest.apiVersion,
          OperationName: operationName,
        });
      } else {
        this.logFunction(message, level, {
          OperationName: operationName,
        });
      }
    } else {
      log.log(level, message);
    }
  }
}

/**
 * OAV expects the url that is sent to match exactly with the swagger path. For this we need to keep only the part after
 * where the swagger path starts. Currently those are '/subscriptions' and '/providers'.
 */
export function formatUrlToExpectedFormat(requestUrl: string): string {
  return requestUrl.substring(requestUrl.search("/?(subscriptions|providers)/i"));
}
