import { parse as urlParse } from "url";
import { Key, pathToRegexp } from "path-to-regexp";
import { lowerHttpMethods, Parameter, PathParameter, Schema } from "../swagger/swaggerTypes";
import { xmsParameterizedHost } from "../util/constants";
import { OperationMatch } from "../liveValidation/operationSearcher";
import { resolveNestedDefinitionTransformer } from "./resolveNestedDefinitionTransformer";
import { SpecTransformer, TransformerType } from "./transformer";
import { traverseSwagger } from "./traverseSwagger";

export type RegExpWithKeys = RegExp & {
  _keys: string[];
  _hostTemplate?: boolean;
  _hasMultiPathParam?: boolean;
};
const buildPathRegex = (
  hostTemplate: string,
  basePathPrefix: string,
  path: string,
  pathParams: Map<string, PathParameter>
): RegExpWithKeys => {
  hostTemplate = hostTemplate.replace("https://", "");
  hostTemplate = hostTemplate.replace("http://", "");

  if (path.endsWith("/")) {
    path = path.substr(0, path.length - 1);
  }

  const params: string[] = [];

  function collectParamName(regResult: string) {
    if (regResult) {
      const paramName = regResult.replace("{", "").replace("}", "");

      if (!params.includes(paramName)) {
        params.push(paramName);
      }
    }
  }

  // collect all parameter name
  const regHostParams = hostTemplate.match(/({[\w-]+})/gi);

  if (regHostParams) {
    regHostParams.forEach(collectParamName);
  }
  const regPathParams = path.match(/({[\w-]+})/gi);

  if (regPathParams) {
    regPathParams.forEach(collectParamName);
  }

  hostTemplate = hostTemplate.replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  path = path.replace(/\(/g, "\\(").replace(/\)/g, "\\)");

  /**
   * To support parameter name with dash(-), replace the parameter names to array index,
   * and will restore the name in the result object regexp later.
   * It caused by a design issue in pathToRegexp library that the parameter names must use "word characters" ([A-Za-z0-9_]).
   * for more details,see https://github.com/pillarjs/path-to-regexp
   **/

  let hasMultiPathParam = false;
  params.forEach((v, i) => {
    if (path.startsWith(`/{${v}}`) && pathParams.get(v)) {
      // We allow first param in path as multi path param
      path = path.replace("{" + v + "}", "(.*)");
      hasMultiPathParam = true;
    } else {
      hostTemplate = hostTemplate.replace("{" + v + "}", ":" + i);
      path = path.replace("{" + v + "}", ":" + i);
    }
  });

  const processedPath = hostTemplate + basePathPrefix + path;

  const keys: Key[] = [];
  const regexp = pathToRegexp(processedPath, keys, { sensitive: false });

  // restore parameter name
  const _keys: string[] = [];
  keys.forEach((v, i) => {
    if (params[v.name as any]) {
      _keys[i + 1] = params[v.name as any];
    }
  });

  const regexpWithKeys: RegExpWithKeys = regexp as RegExpWithKeys;
  regexpWithKeys._keys = _keys;
  if (hostTemplate !== "") {
    regexpWithKeys._hostTemplate = true;
  }
  if (hasMultiPathParam) {
    regexpWithKeys._hasMultiPathParam = true;
  }

  return regexpWithKeys;
};

export const pathRegexTransformer: SpecTransformer = {
  type: TransformerType.Spec,
  after: [resolveNestedDefinitionTransformer],
  transform(spec, { schemaValidator, jsonLoader }) {
    let basePathPrefix = spec.basePath ?? "";
    if (basePathPrefix.endsWith("/")) {
      basePathPrefix = basePathPrefix.substr(0, basePathPrefix.length - 1);
    }
    const msParameterizedHost = spec[xmsParameterizedHost];
    const hostTemplate = msParameterizedHost?.hostTemplate ?? "";
    const hostParams = msParameterizedHost?.parameters;

    traverseSwagger(spec, {
      onPath: (path, pathTemplate) => {
        let pathStr = pathTemplate;
        if ([...pathStr.matchAll(/\{/g)].length !== [...pathStr.matchAll(/\}/g)].length) {
          throw new Error(`Brackets should be deployed in symmetric pairs`);
        }
        const queryIdx = pathTemplate.indexOf("?");
        if (queryIdx !== -1) {
          // path in x-ms-paths has query part we need to match
          const queryMatch = urlParse(pathStr, true).query;
          const querySchema: Schema = { type: "object", properties: {}, required: [] };
          for (const queryKey of Object.keys(queryMatch)) {
            const queryVal = queryMatch[queryKey];
            querySchema.required!.push(queryKey);
            querySchema.properties![queryKey] = {
              enum: typeof queryVal === "string" ? [queryVal] : queryVal,
            };
          }
          path._validateQuery = schemaValidator.compile(querySchema);
          pathStr = pathTemplate.substr(0, queryIdx);
        }

        const pathParams = new Map<string, PathParameter>();
        const collectPathParams = (params?: Parameter[]) => {
          if (params !== undefined) {
            for (const p of params) {
              const param = jsonLoader.resolveRefObj(p);
              if (param.in === "path") {
                pathParams.set(param.name, param);
              }
            }
          }
        };
        collectPathParams(hostParams);
        collectPathParams(path.parameters);
        for (const httpMethod of lowerHttpMethods) {
          collectPathParams(path[httpMethod]?.parameters);
        }

        path._pathRegex = buildPathRegex(hostTemplate, basePathPrefix, pathStr, pathParams);
      },
      onOperation: (operation) => {
        if (operation.externalDocs !== undefined) {
          operation.externalDocs = undefined;
        }
      },
      onResponse: (response) => {
        if (response.examples !== undefined) {
          response.examples = undefined;
        }
      },
    });
  },
};

export const extractPathParamValue = ({ pathRegex, pathMatch }: OperationMatch) => {
  const pathParam: { [key: string]: string } = {};
  const _keys = pathRegex._keys;
  for (let idx = 1; idx < pathMatch.length; ++idx) {
    if (_keys[idx] !== undefined) {
      pathParam[_keys[idx]] = decodeURIComponent(pathMatch[idx]);
    }
  }
  return pathParam;
};
