// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { flatMap } from "@ts-common/iterator";
import { pathToRegexp, Key } from "path-to-regexp";

export const splitPathAndReverse = (p: string | undefined): string[] | undefined =>
  p === undefined ? undefined : Array.from(flatMap(p.split("/"), (s) => s.split("\\"))).reverse();

export const isSubPath = (
  mainPath: readonly string[] | undefined,
  subPath: readonly string[] | undefined
): boolean =>
  // return `true` if there are no subPath.
  subPath === undefined ||
  subPath.length === 0 ||
  // return `true` if `subPath` is a sub-path of `mainPath`.
  (mainPath !== undefined &&
    mainPath.length > subPath.length &&
    subPath.every((s, i) => mainPath[i] === s));

export const buildRegex = (hostTemplate: string, basePathPrefix: string, path: string): RegExp => {
  hostTemplate = hostTemplate.replace("https://", "");
  hostTemplate = hostTemplate.replace("http://", "");

  const params: string[] = [];

  function collectParamName(regResult: string) {
    if (regResult) {
      const paramName = regResult.replace("{", "").replace("}", "");

      if (params.indexOf(paramName) === -1) {
        params.push(paramName);
      }
    }
  }

  // collect all parameter name
  const regHostParams = hostTemplate.match(/({[\w-]+})/gi);

  if (regHostParams) {
    regHostParams.forEach((v) => collectParamName(v));
  }
  const regPathParams = path.match(/({[\w-]+})/gi);

  if (regPathParams) {
    regPathParams.forEach((v) => collectParamName(v));
  }

  /**
   * To support parameter name with dash(-), replace the parameter names to array index,
   * and will restore the name in the result object regexp later.
   * It caused by a design issue in pathToRegexp library that the parameter names must use "word characters" ([A-Za-z0-9_]).
   * for more details,see https://github.com/pillarjs/path-to-regexp
   **/

  params.forEach((v, i) => {
    hostTemplate = hostTemplate.replace("{" + v + "}", "{" + i + "}");
    path = path.replace("{" + v + "}", "{" + i + "}");
  });

  const processedPath =
    hostTemplate
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/\{/g, ":")
      .replace(/\}/g, "") +
    basePathPrefix +
    path.replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\{/g, ":").replace(/\}/g, "");

  const keys: Key[] = [];
  const regexp = pathToRegexp(processedPath, keys, { sensitive: false });

  // restore parameter name
  keys.forEach(function (v, i) {
    if (params[v.name as any]) {
      keys[i].name = params[v.name as any];
    }
  });
  return regexp;
};
