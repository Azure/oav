import { parseJson, ReportError } from "@azure-tools/openapi-tools-common";
import * as yaml from "js-yaml";
import { SwaggerObject } from "yasway";

/*
 * Removes byte order marker. This catches EF BB BF (the UTF-8 BOM)
 * because the buffer-to-string conversion in `fs.readFile()`
 * translates it to FEFF, the UTF-16 BOM.
 */
export function stripBOM(content: Buffer | string): string {
  if (Buffer.isBuffer(content)) {
    content = content.toString();
  }
  if (content.charCodeAt(0) === 0xfeff || content.charCodeAt(0) === 0xfffe) {
    content = content.slice(1);
  }
  return content;
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
  reportError: ReportError
): SwaggerObject {
  try {
    const sanitizedContent = stripBOM(fileContent);
    if (/.*\.json$/gi.test(filePath)) {
      return parseJson(filePath, sanitizedContent, reportError) as SwaggerObject;
    } else if (/.*\.ya?ml$/gi.test(filePath)) {
      return yaml.load(sanitizedContent) as SwaggerObject;
    } else {
      const msg =
        `We currently support "*.json" and "*.yaml | *.yml" file formats for` +
        `validating swaggers. \n The current file extension in "${filePath}" ` +
        `is not supported.`;
      throw new Error(msg);
    }
  } catch (e) {
    throw new Error(`Unable to parse swagger, inner error: ${e.message}`);
  }
}
