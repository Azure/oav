import { ParsedUrlQuery } from "querystring";
import { LiveValidationError } from "../models";
import { LowerHttpMethods, Operation, SwaggerSpec } from "../swagger/swaggerTypes";
import { RegExpWithKeys } from "../transform/pathRegexTransformer";
import { traverseSwagger } from "../transform/traverseSwagger";
import {
  ErrorCodes,
  knownTitleToResourceProviders,
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

// Key http method, e.g. get
type ApiVersion = Map<LowerHttpMethods, Operation[]>;

// Key api-version, e.g. 2020-01-01
type Provider = Map<string, ApiVersion>;

export class OperationSearcher {
  // Key provider, e.g. Microsoft.ApiManagement
  public readonly cache = new Map<string, Provider>();

  public constructor(
    private logging: (
      message: string,
      level?: LiveValidatorLoggingLevels,
      operationName?: string,
      validationRequest?: ValidationRequest
    ) => void
  ) {}

  public addSpecToCache(spec: SwaggerSpec) {
    traverseSwagger(spec, {
      onOperation: (operation, path, method) => {
        const httpMethod = method.toLowerCase() as LowerHttpMethods;
        const pathObject = path;
        const pathStr = pathObject._pathTemplate;
        let apiVersion = spec.info.version;
        let provider = getProviderFromPathTemplate(pathStr);

        const addOperationToCache = () => {
          let apiVersions = this.cache.get(provider!);
          if (apiVersions === undefined) {
            apiVersions = new Map();
            this.cache.set(provider!, apiVersions);
          }

          let allMethods = apiVersions.get(apiVersion);
          if (allMethods === undefined) {
            allMethods = new Map();
            apiVersions.set(apiVersion, allMethods);
          }

          let operationsForHttpMethod = allMethods.get(httpMethod);
          if (operationsForHttpMethod === undefined) {
            operationsForHttpMethod = [];
            allMethods.set(httpMethod, operationsForHttpMethod);
          }

          operationsForHttpMethod.push(operation);
        };

        this.logging(
          `${apiVersion}, ${operation.operationId}, ${pathStr}, ${httpMethod}`,
          LiveValidatorLoggingLevels.debug
        );

        if (!apiVersion) {
          this.logging(
            `Unable to find apiVersion for path : "${pathObject._pathTemplate}".`,
            LiveValidatorLoggingLevels.error
          );
          apiVersion = unknownApiVersion;
        }
        apiVersion = apiVersion.toLowerCase();

        if (!provider) {
          const title = spec.info.title;

          // Whitelist lookups: Look up knownTitleToResourceProviders
          // Putting the provider namespace onto operation for future use
          if (title && knownTitleToResourceProviders[title]) {
            operation.provider = knownTitleToResourceProviders[title];
          }

          // Put the operation into 'Microsoft.Unknown' RPs
          provider = unknownResourceProvider;
          this.logging(
            `Unable to find provider for path : "${pathObject._pathTemplate}". ` +
              `Bucketizing into provider: "${provider}"`,
            LiveValidatorLoggingLevels.debug
          );
        }
        provider = provider.toLowerCase();

        addOperationToCache();
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
    const searchOperation = () => {
      const operations = this.getPotentialOperations(requestInfo);
      if (operations.reason !== undefined) {
        this.logging(
          `${operations.reason.message} with requestUrl ${requestInfo.requestUrl}`,
          LiveValidatorLoggingLevels.info,
          "Oav.OperationSearcher.getPotentialOperations",
          requestInfo
        );
      }
      return operations;
    };
    let potentialOperations = searchOperation();
    const firstReason = potentialOperations.reason;

    if (potentialOperations!.matches.length === 0) {
      this.logging(
        `Fallback to ${unknownResourceProvider} -> ${unknownApiVersion}`,
        LiveValidatorLoggingLevels.info,
        "Oav.OperationSearcher.search",
        requestInfo
      );
      requestInfo.apiVersion = unknownApiVersion;
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
        LiveValidatorLoggingLevels.info,
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
const providerRegEx = new RegExp("/providers/(:?[^{/]+)", "gi");

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
