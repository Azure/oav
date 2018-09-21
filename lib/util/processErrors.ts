// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { NodeError } from "./validationError"
import { isArray, filterMap } from "@ts-common/iterator"
import { jsonSymbol } from "@ts-common/z-schema"
import { getInfo, getRootObjectInfo } from '@ts-common/source-map'
import { TitleObject } from '../validators/specTransformer'
import { log } from './logging'
import { getDescendantFilePosition } from "@ts-common/source-map"
import { Suppression } from '@ts-common/azure-openapi-markdown';

export const processErrors = <T extends NodeError<T>>(
  suppression: Suppression | undefined,
  errors: T[] | undefined,
): T[] | undefined =>
  createErrorProcessor<T>(suppression)(errors)

const addFileInfo = <T extends NodeError<T>>(error: T): T => {
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

const createErrorProcessor = <T extends NodeError<T>>(suppression: Suppression | undefined) => {

  const isSuppressed = suppression === undefined ?
    () => false :
    (error: T): boolean =>
      suppression.directive.some(item => error.code === item.suppress)

  const one = (error: T): T | undefined => {
    error = addFileInfo(error)
    if (isSuppressed(error)) {
      return undefined
    }
    error.errors = multiple(error.errors)
    error.inner = multiple(error.inner)
    return error
  }
  const multiple = (errors: T[] | undefined) =>
    errors === undefined ? undefined : Array.from(filterMap(errors, one))
  return multiple
}
