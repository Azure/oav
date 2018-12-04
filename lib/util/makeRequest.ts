import * as jsonParser from "@ts-common/json-parser"
import retry from "async-retry"
import * as yaml from "js-yaml"
import * as util from "util"
import { SwaggerObject } from "yasway"
import fetch from "node-fetch"
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
  fileContent: string,
  reportError: jsonParser.ReportError,
): SwaggerObject {
  const sanitizedContent = stripBOM(fileContent)
  if (/.*\.json$/gi.test(filePath)) {
    return jsonParser.parse(
      filePath,
      sanitizedContent,
      reportError,
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
export async function makeRequest(
  url: string,
  reportError: jsonParser.ReportError
): Promise<SwaggerObject> {
  return retry<SwaggerObject>(
    async (bail, retryNr): Promise<SwaggerObject> => {
      try {
        const response = await fetch(url)
        const body = await response.text()

        if (response.status !== 200) {
          const msg = `StatusCode: "${
            response.status
          }", ResponseBody: "${body}."`

          return bail(new Error(msg)) as any
        }

        try {
          return parseContent(url, body, reportError)
        } catch (parseError) {
          const text = util.inspect(parseError, { depth: null })
          const msg = `An error occurred while parsing the file ${url} on
          retry number ${retryNr}.. The error is:\n ${text}.`

          return bail(new Error(msg)) as any
        }
      } catch (fetchError) {
        const message = `Request to ${url} failed with error ${fetchError} on
        retry number ${retryNr}.`

        throw new Error(message)
      }
    },
    {
      retries: 3,
      factor: 1
    }
  )
}
