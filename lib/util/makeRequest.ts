import request = require("request")
import { SwaggerObject } from "yasway"
import * as jsonParser from "@ts-common/json-parser"
import * as yaml from "js-yaml"
import * as util from "util"

/*
 * Removes byte order marker. This catches EF BB BF (the UTF-8 BOM)
 * because the buffer-to-string conversion in `fs.readFile()`
 * translates it to FEFF, the UTF-16 BOM.
 */
export function stripBOM(content: Buffer | string): string {
  if (Buffer.isBuffer(content)) {
    content = content.toString()
  }
  if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
    content = content.slice(1)
  }
  return content
}

/*
 * Provides a parsed JSON from the given content.
 *
 * @param {string} filePath - A local file path or a (github) url to the swagger spec.
 *
 * @param {string} fileContent - The content to be parsed.
 *
 * @returns {object} jsonDoc - Parsed document in JSON format.
 */
export function parseContent(
  filePath: string,
  fileContent: string
): SwaggerObject {
  const sanitizedContent = stripBOM(fileContent)
  if (/.*\.json$/gi.test(filePath)) {
    return jsonParser.parse(
      filePath,
      sanitizedContent,
      e => {
        throw Error(e.message)
      }
    ) as SwaggerObject
  } else if (/.*\.ya?ml$/gi.test(filePath)) {
    return yaml.safeLoad(sanitizedContent)
  } else {
    const msg =
      `We currently support "*.json" and "*.yaml | *.yml" file formats for validating swaggers.\n` +
      `The current file extension in "${filePath}" is not supported.`
    throw new Error(msg)
  }
}

export type Options = request.CoreOptions &
  request.UrlOptions & {
    readonly url: string
    readonly errorOnNon200Response: unknown
  }

/*
 * Makes a generic request. It is a wrapper on top of request.js library that provides a promise
 * instead of a callback.
 *
 * @param {object} options - The request options as described over here
 *                           https://github.com/request/request#requestoptions-callback
 *
 * @param {boolean} options.errorOnNon200Response If true will reject the promise with an error if
 *                                                the response statuscode is not 200.
 *
 * @return {Promise} promise - A promise that resolves to the responseBody or rejects to an error.
 */
export async function makeRequest(options: Options): Promise<SwaggerObject> {
  const promise = new Promise<SwaggerObject>((resolve, reject) => {
    request(options, (err, response, responseBody) => {
      if (err) {
        reject(err)
      }
      if (options.errorOnNon200Response && response.statusCode !== 200) {
        const msg = `StatusCode: "${
          response.statusCode
        }", ResponseBody: "${responseBody}."`
        reject(new Error(msg))
      }
      let res = responseBody
      try {
        if (typeof responseBody.valueOf() === "string") {
          res = parseContent(options.url, responseBody)
        }
      } catch (error) {
        const url = options.url
        const text = util.inspect(error, { depth: null })
        const msg = `An error occurred while parsing the file ${url}. The error is:\n ${text}.`
        const e = new Error(msg)
        reject(e)
      }

      resolve(res)
    })
  })
  return await promise
}
