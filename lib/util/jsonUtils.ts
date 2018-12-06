import { Suppression, SuppressionItem } from "@azure/openapi-markdown"
import * as it from "@ts-common/iterator"
import * as jsonParser from "@ts-common/json-parser"
import {
  FilePosition,
  getDescendantFilePosition,
  getFilePosition
} from "@ts-common/source-map"
import { MutableStringMap } from "@ts-common/string-map"
import * as vfs from "@ts-common/virtual-fs"
import jp = require("jsonpath")
import { SwaggerObject } from "yasway"

import * as docs from "./documents"
import { log } from "./logging"
import { parseContent } from "./makeRequest"
import { isSubPath, splitPathAndReverse } from "./path"

const setSuppression = (info: FilePosition | undefined, code: string) => {
  if (info !== undefined) {
    if (info.directives === undefined) {
      (info as any).directives = {}
    }
    const directives = info.directives as MutableStringMap<boolean>
    directives[code] = true
  }
}

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
  reportError: jsonParser.ReportError
): Promise<SwaggerObject> {

  const getSuppressionArray = (
    suppressionItems: ReadonlyArray<SuppressionItem>
  ): ReadonlyArray<SuppressionItem> => {
    const urlReversed = splitPathAndReverse(specPath)
    return suppressionItems.filter(
      s => it.some(
        it.isArray(s.from) ? s.from : [s.from],
        from => isSubPath(urlReversed, splitPathAndReverse(from))
      )
    )
  }

  const suppressionArray =
    suppression === undefined ? [] : getSuppressionArray(suppression.directive)

  if (!specPath || (specPath && typeof specPath.valueOf() !== "string")) {
    throw new Error(
      "A (github) url or a local file path to the swagger spec is required and must be of type " +
        "string."
    )
  }

  const doc = docs.docCache[specPath]

  const applySuppression = (result: SwaggerObject) => {
    const rootInfo = getFilePosition(result)
    // apply suppression
    for (const s of suppressionArray) {
      if (s.where !== undefined) {
        const paths = it.flatMap(
          it.isArray(s.where) ? s.where : [s.where],
          where => {
            try {
              return jp.paths(result, where)
            } catch (e) {
              log.error(e)
              // TODO: return the error.
              return []
            }
          }
        )
        for (const p of paths) {
          // drop "$" and apply suppressions.
          setSuppression(getDescendantFilePosition(result, it.drop(p)), s.suppress)
        }
      } else {
        setSuppression(rootInfo, s.suppress)
      }
    }
    return result
  }

  if (doc) {
    return await doc
  }

    // If the spec path is a url starting with https://github then let us auto convert it to an
    // https://raw.githubusercontent url.
    if (specPath.startsWith("https://github")) {
      specPath = specPath.replace(
        /^https:\/\/(github.com)(.*)blob\/(.*)/gi,
        "https://raw.githubusercontent.com$2$3"
      )
    }

  const createSwaggerObject = async () => {
    const fileContent = await vfs.readFile(specPath)
    const swaggerObject = parseContent(specPath, fileContent, reportError)
    applySuppression(swaggerObject)
    return swaggerObject
  }

  const swaggerObjectPromise = createSwaggerObject()

  docs.docCache[specPath] = swaggerObjectPromise

  return swaggerObjectPromise
}
