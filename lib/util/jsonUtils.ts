import {
  drop,
  FilePosition,
  flatMap,
  getDescendantFilePosition,
  getFilePosition,
  getInfo,
  isArray,
  MutableStringMap,
  readFile,
  ReportError,
  some,
  StringMap,
} from "@azure-tools/openapi-tools-common";
import { Suppression, SuppressionItem } from "@azure/openapi-markdown";
import { default as jsonPointer } from "json-pointer";
import { JSONPath } from "jsonpath-plus";
import { SwaggerObject } from "yasway";
import { DocCache } from "./documents";
import { log } from "./logging";
import { parseContent } from "./makeRequest";
import { isSubPath, splitPathAndReverse } from "./path";
import { checkAndResolveGithubUrl } from "./utils";

const setSuppression = (info: FilePosition | undefined, item: SuppressionItem) => {
  if (info !== undefined) {
    if (info.directives === undefined) {
      (info as any).directives = {};
    }
    const directives = info.directives as MutableStringMap<string>;
    directives[item.suppress] = item["text-matches"] || ".*";
  }
};

export const applySuppression = (
  specObject: any,
  specPath: string,
  suppression: Suppression | undefined
) => {
  const getSuppressionArray = (
    suppressionItems: readonly SuppressionItem[]
  ): readonly SuppressionItem[] => {
    const urlReversed = splitPathAndReverse(specPath);
    return suppressionItems.filter((s) =>
      some(isArray(s.from) ? s.from : [s.from], (from) =>
        isSubPath(urlReversed, splitPathAndReverse(from))
      )
    );
  };

  const suppressionArray =
    suppression === undefined ? [] : getSuppressionArray(suppression.directive);

  if (!specPath || (specPath && typeof specPath.valueOf() !== "string")) {
    throw new Error(
      "A (github) url or a local file path to the swagger spec is required and must be of type " +
        "string."
    );
  }

  const rootInfo = getFilePosition(specObject);
  // apply suppression
  for (const s of suppressionArray) {
    if (s.where !== undefined) {
      const paths = flatMap(isArray(s.where) ? s.where : [s.where], (where) => {
        try {
          return JSONPath<any[]>({ path: where, json: specObject, resultType: "path" });
        } catch (e) {
          log.error(e);
          // TODO: return the error.
          return [];
        }
      });
      for (const p of paths) {
        // drop "$" and apply suppressions.
        setSuppression(
          getDescendantFilePosition(specObject, drop((JSONPath as any).toPathArray(p))),
          s
        );
      }
    } else {
      setSuppression(rootInfo, s);
    }
  }
};

/*
 * Provides a parsed JSON from the given file path or a url.
 *
 * @param {string} specPath - A local file path or a (github) url to the swagger spec.
 * The method will auto convert a github url to raw github url.
 *
 * @returns {object} jsonDoc - Parsed document in JSON format.
 */
export async function parseJson(
  suppression: Suppression | undefined,
  specPath: string,
  reportError: ReportError,
  docsCache?: DocCache
): Promise<SwaggerObject> {
  const doc = docsCache && docsCache[specPath];
  if (doc) {
    return doc;
  }

  specPath = checkAndResolveGithubUrl(specPath);

  const createSwaggerObject = async () => {
    const fileContent = await getSpecContent(specPath);
    if (fileContent === "") {
      throw new Error(`The content of ${specPath} is empty`);
    }

    const swaggerObject = parseContent(specPath, fileContent, reportError);
    applySuppression(swaggerObject, specPath, suppression);
    return swaggerObject;
  };

  const swaggerObjectPromise = createSwaggerObject();

  if (docsCache) {
    docsCache[specPath] = swaggerObjectPromise;
  }

  return swaggerObjectPromise;
}

const getSpecContent = async (specPath: string) => {
  try {
    return await readFile(specPath);
  } catch (error) {
    throw new Error(`Failed to load a reference file ${specPath}. (${error})`);
  }
};

export const findUndefinedWithinDocRefs = (
  specInJson: StringMap<unknown>
): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  for (const section of JSONPath({ path: "$..['$ref']", json: specInJson, resultType: "all" })) {
    if (section.value.startsWith("#/") && !jsonPointer.has(specInJson, section.value.slice(1))) {
      result.set(section.value, (JSONPath as any).toPathArray(section.path) as string[]);
    }
  }
  return result;
};

export const jsonPathToArray = (jsonPath: string): string[] => {
  return (JSONPath as any).toPathArray(jsonPath);
};

export const jsonPathToPointer = (jsonPath: string): string => {
  return jsonPointer.compile(jsonPathToArray(jsonPath).slice(1));
};

export const getFilePositionFromJsonPath = (
  obj: any,
  jsonPath: string
): FilePosition | undefined => {
  const pathArr = jsonPathToArray(jsonPath.substr(1));
  /*
   * when jsonPath='/providers/Microsoft.Provider/resource',
   * the split pathArr will be ['/providers/Microsoft','Provider/resource'].
   * Only in this case, these two elements in the array need to be composed together by '.'.
   * So restrict the condition to the path element ends with /providers/Microsoft.
   */
  const newPathArr = pathArr.slice(0);
  const index = newPathArr.findIndex((str) => str.includes("/providers/Microsoft"));
  if (
    index !== -1 &&
    newPathArr[index + 1] !== undefined &&
    newPathArr[index].slice(-20) === "/providers/Microsoft"
  ) {
    newPathArr[index] += "." + newPathArr[index + 1];
    newPathArr.splice(index + 1, 1);
  }
  try {
    const target = jsonPointer.get(obj, jsonPointer.compile(newPathArr));
    const info = getInfo(target);
    if (info !== undefined) {
      return info.position;
    }
  } catch (e) {
    // Pass
  }

  const lastProperty = newPathArr.pop();
  const target = jsonPointer.get(obj, jsonPointer.compile(newPathArr));
  const info = getInfo(target);
  if (info !== undefined && lastProperty !== undefined) {
    return info.primitiveProperties[lastProperty];
  }

  return undefined;
};
