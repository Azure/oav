import { NodeError } from "./validationError"
import { forEach, isArray } from "@ts-common/iterator"
import { jsonSymbol, schemaSymbol } from "z-schema"
import { getInfo, getRootObjectInfo } from '@ts-common/source-map'
import { TitleObject } from '../validators/specTransformer'
import { log } from './logging'
import { getDescendantFilePosition } from "@ts-common/source-map"

export const errorsAddFileInfo = <T extends NodeError<T>, E extends Iterable<T>>(
  errors: E | undefined,
): E | undefined => {
  forEach(errors, errorAddFileInfo)
  return errors
}

interface ErrorEx {
  readonly [jsonSymbol]?: object
  readonly [schemaSymbol]?: object
}

const errorAddFileInfo = <T extends NodeError<T>>(error: T): void => {
  const title = error.title
  if (title !== undefined) {
    try {
      const titleObject: TitleObject | undefined = JSON.parse(title)
      if (titleObject !== undefined) {
        error.position = titleObject.position
        error.url = titleObject.url
        error.title = titleObject.title
      }
    // tslint:disable-next-line:no-empty
    } catch {
      log.error(`ICE: can't parse title: ${title}`)
    }
  }
  const errorEx = error as any as ErrorEx
  const json = errorEx[jsonSymbol]
  if (json !== undefined) {
    const jsonInfo = getInfo(json)
    if (jsonInfo !== undefined) {
      const path = error.path
      if (path !== undefined) {
        error.jsonPosition = getDescendantFilePosition(
          json,
          isArray(path) ? path : path.split("/")
        )
      } else {
        error.jsonPosition = jsonInfo.position
      }
      error.jsonUrl = getRootObjectInfo(jsonInfo).url
    }
  }
  /*
  const schema = errorEx[schemaSymbol]
  if (schema !== null && typeof schema === "object") {
    const schemaInfo = getInfo(schema)
    if (schemaInfo !== undefined) {
      error.position = schemaInfo.position
      error.url = getRootObjectInfo(schemaInfo).url
    }
  }
  */
  errorsAddFileInfo(error.errors)
  errorsAddFileInfo(error.inner)
}
