import { ParsedUrlQuery } from "querystring";
import { LiveValidationError } from "../models";
import {
  lowerHttpMethods,
  LowerHttpMethods,
  Operation,
  SwaggerSpec,
} from "../swagger/swaggerTypes";
import { RegExpWithKeys } from "../transform/pathRegexTransformer";
import { traverseSwagger } from "../transform/traverseSwagger";
import {
  ErrorCodes,
  knownTitleToResourceProviders,
  multipleResourceProvider,
  unknownApiVersion,
  unknownResourceProvider,
} from "../util/constants";
import { Writable } from "../util/utils";
import { LiveValidatorLoggingLevels } from "./liveValidator";
import { ValidationRequest } from "./operationValidator";

export interface OperationMatch {
  operation: Operation;
  pathRegex: RegExpWithKeys;
  pathMatch: RegExpExecArray;
}

interface PotentialOperationsResult {
  readonly matches: OperationMatch[];
  readonly resourceProvider: string;
  readonly apiVersion: string;
  readonly reason?: LiveValidationError;
}

interface CacheEntry {
  fullMatchOps?: Operation[];
  extendMatchOps?: Operation[];
  paramOnlyMatchOps?: Operation[];
}

export class OperationSearcher {
  // Key from getOperationCacheKey()
  public readonly cache = new Map<string, CacheEntry>();

  public constructor(
    private logging: (
      message: string,
      level?: LiveValidatorLoggingLevels,
      operationName?: string,
      validationRequest?: ValidationRequest
    ) => void
  ) {}

  public addSpecToCache(spec: SwaggerSpec) {
    const specProvider = getProviderFromSpecPath(spec._filePath);

    traverseSwagger(spec, {
      onPath: (path) => {
        const pathObject = path;
        const pathStr = pathObject._pathTemplate;
        let apiVersion = spec.info.version;
        let provider = getProviderFromPathTemplate(pathStr);

        if (provider === undefined) {
          provider = unknownResourceProvider;
        } else if (provider.startsWith("{") && provider.endsWith("}")) {
          provider = multipleResourceProvider;
        } else if (provider !== specProvider) {
          this.logging(
            `Provider in path mismatch with spec path: ${pathStr} ${spec._filePath}`,
            LiveValidatorLoggingLevels.error
          );
        }
        provider = provider.toUpperCase();

        if (!apiVersion) {
          this.logging(
            `Unable to find apiVersion for path : "${pathObject._pathTemplate}".`,
            LiveValidatorLoggingLevels.error
          );
          apiVersion = unknownApiVersion;
        }
        apiVersion = apiVersion.toLowerCase();

        let targetSlot: keyof CacheEntry = "fullMatchOps";
        if (path._pathRegex._hasMultiPathParam) {
          targetSlot = "extendMatchOps";
          if (path._pathRegex._keys.length === 1) {
            let slashCount = 0;
            for (let idx = 0; idx < path._pathTemplate.length; ++idx) {
              if (path._pathTemplate[idx] === "/") {
                slashCount++;
              }
            }
            if (slashCount === 1) {
              targetSlot = "paramOnlyMatchOps";
            }
          }
        }

        for (const m of Object.keys(path)) {
          const httpMethod = m as LowerHttpMethods;
          const operation = path[httpMethod];
          if (
            !lowerHttpMethods.includes(httpMethod as LowerHttpMethods) ||
            operation === undefined
          ) {
            continue;
          }

          operation.provider = specProvider;
          const cacheKey = getOperationCacheKey(provider, apiVersion, httpMethod);
          let cacheEntry = this.cache.get(cacheKey);
          if (cacheEntry === undefined) {
            cacheEntry = {};
            this.cache.set(cacheKey, cacheEntry);
          }

          if (cacheEntry[targetSlot] === undefined) {
            cacheEntry[targetSlot] = [operation];
          } else {
            cacheEntry[targetSlot]!.push(operation);
          }

          this.logging(
            `${apiVersion}, ${operation.operationId}, ${pathStr}, ${httpMethod}`,
            LiveValidatorLoggingLevels.debug
          );
        }
      },
    });
  }

  /**
   * Gets the swagger operation based on the HTTP url and method
   */
  public search(
    info: ValidationRequest
  ): {
    operationMatch: OperationMatch;
    apiVersion: string;
  } {
    const requestInfo = { ...info };
    let potentialOperations: PotentialOperationsResult;

    if (requestInfo.providerNamespace === unknownResourceProvider) {
      potentialOperations 
    }
    const searchOperation = () => {
      const operations = this.getPotentialOperations(requestInfo);
      if (operations.reason !== undefined) {
        this.logging(
          `${operations.reason.message} with requestUrl ${requestInfo.requestUrl}`,
          LiveValidatorLoggingLevels.debug,
          "Oav.OperationSearcher.getPotentialOperations",
          requestInfo
        );
      }
      return operations;
    };
    const firstReason = potentialOperations.reason;

    if (potentialOperations!.matches.length === 0) {
      this.logging(
        `Fallback to ${unknownResourceProvider} -> ${requestInfo.apiVersion}`,
        LiveValidatorLoggingLevels.debug,
        "Oav.OperationSearcher.search",
        requestInfo
      );
      requestInfo.providerNamespace = unknownResourceProvider;
      potentialOperations = searchOperation();
    }

    if (potentialOperations.matches.length === 0) {
      throw firstReason ?? potentialOperations.reason;
    }

    if (potentialOperations.matches.length > 1) {
      const operationInfos: Array<{ id: string; path: string; specPath: string }> = [];

      potentialOperations.matches.forEach(({ operation }) => {
        const specPath = operation._path._spec._filePath;
        operationInfos.push({
          id: operation.operationId!,
          path: operation._path._pathTemplate,
          specPath,
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
      const e = new LiveValidationError(ErrorCodes.MultipleOperationsFound.name, msg);
      throw e;
    }

    return {
      operationMatch: potentialOperations.matches[0],
      apiVersion: potentialOperations.apiVersion,
    };
  }

  /**
   * Gets list of potential operations objects for given url and method.
   *
   * @param  requestInfo The parsed request info for which to find potential operations.
   *
   * @returns Potential operation result object.
   */
  public getPotentialOperations(requestInfo: ValidationRequest): PotentialOperationsResult {
    if (this.cache.size === 0) {
      const msgStr =
        `Please call "liveValidator.initialize()" before calling this method, ` +
        `so that cache is populated.`;
      throw new Error(msgStr);
    }

    const ret: Writable<PotentialOperationsResult> = {
      matches: [],
      resourceProvider: requestInfo.providerNamespace,
      apiVersion: requestInfo.apiVersion,
    };

    if (requestInfo.pathStr === "") {
      ret.reason = new LiveValidationError(
        ErrorCodes.PathNotFoundInRequestUrl.name,
        `Could not find path from requestUrl: "${requestInfo.requestUrl}".`
      );
      return ret;
    }

    // Search using provider
    const allApiVersions = this.cache.get(requestInfo.providerNamespace);
    if (allApiVersions === undefined) {
      // provider does not exist in cache
      ret.reason = new LiveValidationError(
        ErrorCodes.OperationNotFoundInCacheWithProvider.name,
        `Could not find provider "${requestInfo.providerNamespace}" in the cache.`
      );
      return ret;
    }

    // Search using api-version found in the requestUrl
    if (!requestInfo.apiVersion) {
      ret.reason = new LiveValidationError(
        ErrorCodes.OperationNotFoundInCacheWithApi.name,
        `Could not find api-version in requestUrl "${requestInfo.requestUrl}".`
      );
      return ret;
    }

    const allMethods = allApiVersions.get(requestInfo.apiVersion);
    if (allMethods === undefined) {
      ret.reason = new LiveValidationError(
        ErrorCodes.OperationNotFoundInCacheWithApi.name,
        `Could not find exact api-version "${requestInfo.apiVersion}" for provider "${requestInfo.providerNamespace}" in the cache.`
      );
      return ret;
    }

    const operationsForHttpMethod = allMethods?.get(requestInfo.requestMethod);
    // Search using requestMethod provided by user
    if (operationsForHttpMethod === undefined) {
      ret.reason = new LiveValidationError(
        ErrorCodes.OperationNotFoundInCacheWithVerb.name,
        `Could not find any methods with verb "${requestInfo.requestMethod}" for api-version "${requestInfo.apiVersion}" and provider "${requestInfo.providerNamespace}" in the cache.`
      );
      return ret;
    }

    // Find the best match using regex on path
    ret.matches = getMatchedOperations(
      requestInfo.host,
      requestInfo.pathStr,
      operationsForHttpMethod,
      requestInfo.query
    );
    if (ret.matches.length === 0 && ret.reason === undefined) {
      ret.reason = new LiveValidationError(
        ErrorCodes.OperationNotFoundInCache.name,
        `Could not find best match operation for verb "${requestInfo.requestMethod}" for api-version "${requestInfo.apiVersion}" and provider "${requestInfo.providerNamespace}" in the cache.`
      );
    }

    return ret;
  }
}

const getOperationCacheKey = (
  resourceProvider: string,
  apiVersion: string,
  httpMethod: LowerHttpMethods
) => {
  return `${resourceProvider}|${apiVersion}|${httpMethod}`;
};

/**
 * Gets provider namespace from the given path. In case of multiple, last one will be returned.
 * @param {string} pathStr The path of the operation.
 *                 Example "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/
 *                  providers/{resourceProviderNamespace}/{parentResourcePath}/{resourceType}/
 *                  {resourceName}/providers/Microsoft.Authorization/roleAssignments"
 *                 will return "Microsoft.Authorization".
 *
 * @returns {string} result - provider namespace from the given path.
 */
export function getProviderFromPathTemplate(pathStr?: string | null): string | undefined {
  if (
    pathStr === null ||
    pathStr === undefined ||
    typeof pathStr.valueOf() !== "string" ||
    !pathStr.trim().length
  ) {
    throw new Error(
      "pathStr is a required parameter of type string and it cannot be an empty string."
    );
  }

  let result;

  // Loop over the paths to find the last matched provider namespace
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const pathMatch = providerRegEx.exec(pathStr);
    if (pathMatch === null) {
      break;
    }
    result = pathMatch[1];
  }

  return result;
}
const providerRegEx = new RegExp("/providers/(:?[^/]+)", "gi");

export function getProviderFromSpecPath(specPath: string): string | undefined {
  const match = providerInSpecPathRegEx.exec(specPath);
  return match === null ? undefined : match[1];
}
const providerInSpecPathRegEx = new RegExp("/resource-manager/(:?[^{/]+)", "gi");

/**
 * Gets list of matched operations objects for given url.
 *
 * @param {string} requestUrl The url for which to find matched operations.
 *
 * @param {Array<Operation>} operations The list of operations to search.
 *
 * @returns {Array<Operation>} List of matched operations with the request url.
 */
const getMatchedOperations = (
  host: string,
  pathStr: string,
  operations: Operation[],
  query?: ParsedUrlQuery
): OperationMatch[] => {
  const queryMatchResult: OperationMatch[] = []; // Priority 0
  const result: OperationMatch[] = []; // Priority 1
  const multiParamResult: OperationMatch[] = []; // Priority 2

  for (const operation of operations) {
    const path = operation._path;
    // Validate query first so we could match operation in x-ms-paths
    const queryMatch =
      path._validateQuery === undefined
        ? undefined
        : path._validateQuery({ isResponse: false }, query).length === 0;
    if (queryMatch === false) {
      continue;
    }

    const toMatch = path._pathRegex._hostTemplate ? host + pathStr : pathStr;
    const pathMatch = path._pathRegex.exec(toMatch);
    if (pathMatch === null) {
      continue;
    }

    (queryMatch !== undefined
      ? queryMatchResult
      : path._pathRegex._hasMultiPathParam
      ? multiParamResult
      : result
    ).push({
      operation,
      pathRegex: path._pathRegex,
      pathMatch,
    });
  }

  return queryMatchResult.length > 0
    ? queryMatchResult
    : result.length > 0
    ? result
    : multiParamResult;
};

const getMatchedOperationsInCacheEntry = (host: string, pathStr: string, cacheEntry: CacheEntry, query?: ParsedUrlQuery): OperationMatch[] => {
  if (cacheEntry.fullMatchOps !== undefined) {
    const result = getMatchedOperations(host, pathStr, cacheEntry.fullMatchOps, query);
    if (result.length > 0) {
      return result;
    }
  }

  if (cacheEntry.extendMatchOps !== undefined) {
    const result = getMatchedOperations(host, pathStr, cacheEntry.extendMatchOps, query);
    if (result.length > 0) {
      return result;
    }
  }

  if (cacheEntry.paramOnlyMatchOps !== undefined) {
    const result = getMatchedOperations(host, pathStr, cacheEntry.paramOnlyMatchOps, query);
    if (result.length > 0) {
      return result;
    }
  }

  return [];
}
