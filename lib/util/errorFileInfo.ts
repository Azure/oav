import { NodeError } from "./validationError"
import { SwaggerObject } from "yasway"
import { getInfo, FileInfo, Info } from "@ts-common/source-map"
import * as jsonPointer from "json-pointer"
import { forEach } from "@ts-common/iterator"

export const errorsAddFileInfo = <T extends NodeError<T>, E extends Iterable<T>>(
  spec: SwaggerObject,
  errors: E|undefined,
): E|undefined => {
  forEach(errors, e => errorAddFileInfo(spec, e))
  return errors
}

const getFileInfo = (info: Info): FileInfo =>
  info.kind === "file" ? info : getFileInfo(info.parent)

const errorAddFileInfo = <T extends NodeError<T>>(spec: SwaggerObject, error: T): void => {
  if (error.title !== undefined) {
    const o = jsonPointer.get(spec, error.title)
    if (o !== undefined && typeof o === "object") {
      const info = getInfo(o as object)
      if (info !== undefined) {
        if (info.kind === "object") {
          error.position = {
            line: info.position.line + 1,
            column: info.position.line + 1,
          }
        }
        error.url = getFileInfo(info).url
      }
    }
  }
  errorsAddFileInfo(spec, error.errors)
  errorsAddFileInfo(spec, error.inner)
}
