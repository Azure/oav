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

/**
 * Escapes literal colons in a path string for path-to-regexp v6 compatibility.
 * Only colons not followed by a valid parameter name are escaped.
 */
function escapeLiteralColons(path: string): string {
  // Escape all bare colons except placeholders like :"0"
  return path.replace(/:(?!\"[0-9]+\")/g, "\\:");
}

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
   *
   * 2025-06-23 scbedd
   *
   * Additionally, when replacing parameters with indices, we need to ensure that we don't accidentally match too much.
   * For example, if we have a parameter in the original path like '{param-name}x{param-name2}', we need to ensure that the
   * parameter matching DOESN'T consume the 'x' character. To achieve this, we append '(\\d+)' to the end of the parameter replacement.
   * By doing this, we are telling path-to-regexp to only match digits for the parameter name, ensuring that the 'x' character remains intact.
   * This is _safe_ because we are replacing _all_ parameters with their indices, so we don't have to support anything NOT named with a digit.
   *
   * Later in the evening 2025-06-23. My replacement approach doesn't work as expected. This is due to the fact that
   * OAV supports users passing their own custom patterns right alongside the parameter name. Something like
   * `{param-name}(\\d+)`. This means that we cannot simply replace the parameter name with `:0(\\d+)` because
   * it would break the custom pattern. My original attempts at using quoted parameters would ALSO work, but I couldn't make
   * that work with path-to-regexp v6.2.1+ which is the version we use in OAV. I have updated to use v8.X, which DOES support
   * quoted parameters, and that is looking promising. Committing this to see if everything works as expected.
   **/

  let hasMultiPathParam = false;
  params.forEach((v, i) => {
    if (path.startsWith(`/{${v}}`) && pathParams.get(v)) {
      // We allow first param in path as multi path param
      path = path.replace("{" + v + "}", "(.*)");
      hasMultiPathParam = true;
    } else {
      hostTemplate = hostTemplate.replace("{" + v + "}", ":" + i);
      // Only append (\d+) if the next character after the replacement is NOT '('
      // const paramPattern = new RegExp(`\\{${v}\\}`);
      // const match = path.match(paramPattern);
      // if (match) {
      //   const idx = match.index! + match[0].length;
      //   if (path[idx] !== "(") {
      //     path = path.replace("{" + v + "}", `:${i}(\\d+)`);
      //   } else {
      //     path = path.replace("{" + v + "}", `:${i}`);
      //   }
      // }
      path = path.replace("{" + v + "}", `:"${i}"`);
    }
  });

  const processedPath = hostTemplate + basePathPrefix + path;

  // in security patched versions of path-to-regexp (read > 6.2.1), colons must refer to valid parameter names
  // so now we have to escape literal colons that are in the path
  const escapedPath = escapeLiteralColons(processedPath);

  // compile the path-to-regexp using new v8 API (returns {regexp, keys})
  // let regexp: RegExp;
  // let keys: Key[];
  // try {
  //   const result = pathToRegexp(escapedPath, { sensitive: false });
  //   regexp = result.regexp;
  //   keys = result.keys;
  // } catch (ex) {
  //   throw ex;
  // }
  const result = pathToRegexp(escapedPath, { sensitive: false });
  const regexp: RegExp = result.regexp;
  const keys: Key[] = result.keys;

  // restore parameter name
  const _keys: string[] = [];
  keys.forEach((v, i) => {
    if (params[v.name as any]) {
      _keys[i + 1] = params[v.name as any];
    }
  });

  // console.log(`Built regex ${regexp}`);
  // console.log(`With keys ${_keys}`);

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
