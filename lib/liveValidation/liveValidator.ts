// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as http from "http"; import * as os from "os";
import * as path from "path";
import { resolve as pathResolve } from "path";
import { ParsedUrlQuery } from "querystring";
import * as url from "url";
import * as util from "util";
import * as _ from "lodash";
import globby from "globby";
import * as models from "../models";
import { requestResponseDefinition } from "../models/requestResponse";
import { LowerHttpMethods, SwaggerSpec } from "../swagger/swaggerTypes";
import {
  SchemaValidateFunction,
  SchemaValidateIssue,
  SchemaValidator,
} from "../swaggerValidator/schemaValidator";
import * as C from "../util/constants";
import { log } from "../util/logging";
import { Severity } from "../util/severity";
import * as utils from "../util/utils";
import { allErrorConstants, ExtendedErrorCode, RuntimeException } from "../util/validationError";
import { inversifyGetContainer, inversifyGetInstance, TYPES } from "../inversifyUtils";
import { setDefaultOpts } from "../swagger/loader";
import { LiveValidatorLoader, LiveValidatorLoaderOption } from "./liveValidatorLoader";
import { getProviderFromPathTemplate, OperationSearcher } from "./operationSearcher";
import {
  LiveRequest,
  LiveResponse,
  OperationContext,
  validateSwaggerLiveRequest,
  validateSwaggerLiveResponse,
  ValidationRequest,
} from "./operationValidator";

export interface LiveValidatorOptions extends LiveValidatorLoaderOption {
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

export interface LiveValidationIssue extends SchemaValidateIssue {
  readonly pathsInPayload: string[];
  readonly severity: Severity;
  readonly documentationUrl?: string;
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

export enum LiveValidatorLoggingLevels {
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
  public options: LiveValidatorOptions;

  public operationSearcher: OperationSearcher;

  private logFunction?: (message: string, level: string, meta?: Meta) => void;

  private loader?: LiveValidatorLoader;

  private loadInBackgroundComplete: boolean = false;

  private validateRequestResponsePair?: SchemaValidateFunction;

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

    setDefaultOpts(ops, {
      swaggerPaths: [],
      excludedSwaggerPathsPattern: C.DefaultConfig.ExcludedSwaggerPathsPattern,
      directory: path.resolve(os.homedir(), "repo"),
      isPathCaseSensitive: false,
      loadValidatorInBackground: true,
      loadValidatorInInitialize: false,
      isArmCall: false,
    });

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

    this.options = ops as LiveValidatorOptions;

    this.operationSearcher = new OperationSearcher(this.logging);
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
    const container = inversifyGetContainer();
    this.loader = inversifyGetInstance(LiveValidatorLoader, {
      container,
      fileRoot: this.options.directory,
      ...this.options,
      loadSuppression: this.options.loadSuppression ?? Object.keys(allErrorConstants),
    });
    const schemaValidator = container.get(TYPES.schemaValidator) as SchemaValidator;
    this.validateRequestResponsePair = await schemaValidator.compileAsync(
      requestResponseDefinition
    );

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
        try {
          const spec = allSpecs.shift()!;
          const loadStart = Date.now();
          await this.loader.buildAjvValidator(spec);
          this.logging(
            `Build validator for ${spec._filePath} with DurationInMs:${Date.now() - loadStart}.`,
            LiveValidatorLoggingLevels.info,
            "Oav.liveValidator.initialize"
          );
        } catch (e) {
          this.logging(
            e.message,
            LiveValidatorLoggingLevels.error,
            "Oav.liveValidator.loadAllSpec"
          );
        }
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
      try {
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
      } catch (e) {
        this.logging(e.message, LiveValidatorLoggingLevels.error, "Oav.liveValidator.loadAllSpec");
      }
    }

    this.loader = undefined;
    this.loadInBackgroundComplete = true;
    this.logging(
      `Build validator for all specs finished in background with DurationInMs:${
        Date.now() - backgroundStartTime
      }.`,
      LiveValidatorLoggingLevels.info,
      "Oav.liveValidator.loadAllSpec"
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

  /**
   * Validates live response.
   */
  public async validateLiveResponse(
    liveResponse: LiveResponse,
    specOperation: { url: string; method: string },
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
    this.transformResponseStatusCode(liveResponse);
    try {
      errors = await validateSwaggerLiveResponse(
        liveResponse,
        info,
        this.loader,
        options.includeErrors,
        this.options.isArmCall
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

    const errors = this.validateRequestResponsePair!({}, requestResponseObj);
    if (errors.length > 0) {
      const error = errors[0];
      const message =
        `Found errors "${error.message}" in the provided input in path ${error.jsonPathsInPayload[0]}:\n` +
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
    this.transformResponseStatusCode(response);

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
            request,
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

  private transformResponseStatusCode(liveResponse: LiveResponse) {
    // If status code is passed as a status code string (e.g. "OK") transform it to the status code
    // number (e.g. '200').
    if (
      !http.STATUS_CODES[liveResponse.statusCode] &&
      utils.statusCodeStringToStatusCode[liveResponse.statusCode.toLowerCase()]
    ) {
      liveResponse.statusCode =
        utils.statusCodeStringToStatusCode[liveResponse.statusCode.toLowerCase()];
    }
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
        const result = this.operationSearcher.search(info.validationRequest);
        info.apiVersion = result.apiVersion;
        info.operationMatch = result.operationMatch;
      }
      info.operationId = info.operationMatch.operation.operationId!;
      return { info };
    } catch (error) {
      return { info, error };
    }
  }

  public parseValidationRequest(
    requestUrl: string,
    requestMethod: string | undefined | null,
    correlationId: string
  ): ValidationRequest {
    return parseValidationRequest(requestUrl, requestMethod, correlationId);
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
    loader: LiveValidatorLoader,
    swaggerPath: string
  ): Promise<SwaggerSpec | undefined> {
    const startTime = Date.now();
    this.logging(`Building cache from: "${swaggerPath}"`, LiveValidatorLoggingLevels.debug);

    try {
      const startTimeLoadSpec = Date.now();
      const spec = await loader.load(pathResolve(swaggerPath));
      const elapsedTimeLoadSpec = Date.now() - startTimeLoadSpec;
      this.logging(
        `Load spec for ${swaggerPath} with DurationInMs:${elapsedTimeLoadSpec}`,
        LiveValidatorLoggingLevels.info,
        "Oav.liveValidator.getSwaggerInitializer.specValidator.initialize"
      );

      this.operationSearcher.addSpecToCache(spec);

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

  private logging = (
    message: string,
    level?: LiveValidatorLoggingLevels,
    operationName?: string,
    validationRequest?: ValidationRequest
  ) => {
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
  };
}

/**
 * OAV expects the url that is sent to match exactly with the swagger path. For this we need to keep only the part after
 * where the swagger path starts. Currently those are '/subscriptions' and '/providers'.
 */
export function formatUrlToExpectedFormat(requestUrl: string): string {
  return requestUrl.substring(requestUrl.search("/?(subscriptions|providers)/i"));
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
export const parseValidationRequest = (
  requestUrl: string,
  requestMethod: string | undefined | null,
  correlationId: string
): ValidationRequest => {
  if (
    requestUrl === undefined ||
    requestUrl === null ||
    typeof requestUrl.valueOf() !== "string" ||
    !requestUrl.trim().length
  ) {
    const msg =
      "An error occurred while trying to parse validation payload." +
      'requestUrl is a required parameter of type "string" and it cannot be an empty string.';
    const e = new models.LiveValidationError(C.ErrorCodes.PotentialOperationSearchError.name, msg);
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
    const e = new models.LiveValidationError(C.ErrorCodes.PotentialOperationSearchError.name, msg);
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
    apiVersion = (queryObject["api-version"] || C.unknownApiVersion) as string;
    providerNamespace = getProviderFromPathTemplate(pathStr) || C.unknownResourceProvider;
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
    requestMethod: requestMethod as LowerHttpMethods,
    host: parsedUrl.host!,
    pathStr,
    query: queryStr,
    correlationId,
    requestUrl,
  };
};
