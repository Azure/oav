import { Suppression, SuppressionItem } from '@azure/openapi-markdown'
import { SwaggerObject } from 'yasway'
import { splitPathAndReverse, isSubPath } from './path'
import * as it from "@ts-common/iterator"
import * as docs from "./documents"
import { getFilePosition, FilePosition, getDescendantFilePosition } from '@ts-common/source-map'
import jp = require("jsonpath")
import { MutableStringMap } from '@ts-common/string-map'
import { makeRequest, parseContent } from './makeRequest'
import * as fs from "fs"
import { log } from "./logging"
import * as jsonParser from "@ts-common/json-parser"
import * as reportError from "./reportError"

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
  re: reportError.Report
): Promise<SwaggerObject> {

  const reportJsonParseError = (e: jsonParser.ParseError) => re("JSON_PARSING_ERROR", e.message)

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
  // url
  if (specPath.match(/^http.*/gi) !== null) {
    // If the spec path is a url starting with https://github then let us auto convert it to an
    // https://raw.githubusercontent url.
    if (specPath.startsWith("https://github")) {
      specPath = specPath.replace(
        /^https:\/\/(github.com)(.*)blob\/(.*)/gi,
        "https://raw.githubusercontent.com$2$3"
      )
    }
    const res = makeRequest({ url: specPath, errorOnNon200Response: true }, reportJsonParseError)
      .then(applySuppression)
    docs.docCache[specPath] = res
    return await res
  } else {
    // local file path
    try {
      const fileContent = fs.readFileSync(specPath, "utf8")
      const result = parseContent(specPath, fileContent, reportJsonParseError)
      applySuppression(result)
      docs.docCache[specPath] = Promise.resolve(result)
      return result
    } catch (err) {
      const msg =
        `Unable to read the content or execute "JSON.parse()" on the content of file ` +
        `"${specPath}". The error is:\n${err}`
      const e = new Error(msg)
      log.error(e.toString())
      throw e
    }
  }
}
