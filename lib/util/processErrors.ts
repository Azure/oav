import { NodeError } from "./validationError"
import { isArray, filterMap } from "@ts-common/iterator"
import { jsonSymbol } from "@ts-common/z-schema"
import { getInfo, getRootObjectInfo } from '@ts-common/source-map'
import { TitleObject } from '../validators/specTransformer'
import { log } from './logging'
import { getDescendantFilePosition } from "@ts-common/source-map"
import { Suppression } from '@ts-common/azure-openapi-markdown';

const errorAddFileInfo = <T extends NodeError<T>>(error: T): T => {
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
  return error
}

const createErrorProcessor = <T extends NodeError<T>>(_suppression: Suppression | undefined) => {
  const one = (error: T): T | undefined => {
    error = errorAddFileInfo(error)
    error.errors = multiple(error.errors)
    error.inner = multiple(error.inner)
    return error
  }
  const multiple = (errors: T[] | undefined) =>
    errors === undefined ? undefined : Array.from(filterMap(errors, one))
  return multiple
}

export const processErrors = <T extends NodeError<T>>(
  errors: T[] | undefined,
): T[] | undefined =>
  createErrorProcessor<T>(undefined)(errors)
