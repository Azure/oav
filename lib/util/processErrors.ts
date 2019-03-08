// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { filterMap, isArray } from "@ts-common/iterator"
import { setMutableProperty } from "@ts-common/property-set"
import {
  getAllDirectives,
  getDescendantFilePosition,
  getInfo,
  getRootObjectInfo
} from "@ts-common/source-map"
import { merge } from "@ts-common/string-map"
import { jsonSymbol, schemaSymbol } from "z-schema"

import { TitleObject } from "../validators/specTransformer"
import { CommonError } from "./commonError"
import { log } from "./logging"
import { NodeError } from "./validationError"

export const processErrors = <T extends NodeError<T>>(errors: T[] | undefined) =>
  errors === undefined ? undefined : Array.from(filterMap(errors, one))

export const setPositionAndUrl = (error: CommonError, titleObject: TitleObject | undefined) => {
  if (titleObject !== undefined) {
    const { path } = titleObject
    error.position = titleObject.position
    error.url = titleObject.url
    if (path !== undefined) {
      error.title = "/" + path.join("/")
    }
    error.directives = titleObject.directives
  }
}

const addFileInfo = <T extends NodeError<T>>(error: T): T => {
  const title = error.title
  if (error.position === undefined && title !== undefined) {
    try {
      const titleObject: TitleObject | undefined = JSON.parse(title)
      setPositionAndUrl(error, titleObject)
    } catch {
      log.error(`ICE: can't parse title: ${title}`)
    }
  }
  const json = error[jsonSymbol]
  if (error.jsonPosition === undefined && json !== undefined) {
    const jsonInfo = getInfo(json)
    if (jsonInfo !== undefined) {
      const errorPathOriginal = error.path
      const errorPath =
        errorPathOriginal === undefined
          ? undefined
          : isArray(errorPathOriginal)
          ? errorPathOriginal
          : errorPathOriginal.split("/")
      setMutableProperty(error, "jsonPosition", getDescendantFilePosition(json, errorPath))
      error.directives = merge(error.directives, getAllDirectives(json, errorPath))
      error.jsonUrl = getRootObjectInfo(jsonInfo).url
    }
  }
  delete (error as any)[jsonSymbol]
  delete (error as any)[schemaSymbol]
  return error
}

const isSuppressed = <T extends NodeError<T>>({ code, directives, message }: T): boolean => {
  if (directives === undefined || code === undefined) {
    return false
  }
  const messageRegEx = directives[code]
  if (messageRegEx === undefined || typeof messageRegEx !== "string") {
    return false
  }
  if (message === undefined) {
    return false
  }
  return new RegExp(messageRegEx).test(message)
}

const one = <T extends NodeError<T>>(error: T): T | undefined => {
  error = addFileInfo(error)
  if (isSuppressed(error)) {
    return undefined
  }
  setMutableProperty(error, "errors", processErrors(error.errors))
  setMutableProperty(error, "inner", processErrors(error.inner))
  setMutableProperty(error, "innerErrors", processErrors(error.innerErrors))
  return error
}
