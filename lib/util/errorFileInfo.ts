import { NodeError } from "./validationError"
import { forEach, isArray } from "@ts-common/iterator"
import { jsonSymbol } from "z-schema"
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
  const json = error[jsonSymbol]
  if (json !== undefined) {
    const jsonInfo = getInfo(json)
    if (jsonInfo !== undefined) {
      const path = error.path
      error.jsonPosition = getDescendantFilePosition(
        json,
        path === undefined ? undefined : isArray(path) ? path : path.split("/")
      )
      error.jsonUrl = getRootObjectInfo(jsonInfo).url
    }
  }
  errorsAddFileInfo(error.errors)
  errorsAddFileInfo(error.inner)
}
