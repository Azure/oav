// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { NodeError } from "./validationError"
import { isArray, filterMap, flatMap } from "@ts-common/iterator"
import { jsonSymbol } from "z-schema"
import { getInfo, getRootObjectInfo } from '@ts-common/source-map'
import { TitleObject } from '../validators/specTransformer'
import { log } from './logging'
import { getDescendantFilePosition } from "@ts-common/source-map"
import { Suppression } from "@ts-common/azure-openapi-markdown"
import jp = require("jsonpath")
import { createDummyByPath } from "./createDummy"
import { setMutableProperty } from '@ts-common/property-set';

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
      const errorPath = error.path
      setMutableProperty(
        error,
        "jsonPosition",
        getDescendantFilePosition(
          json,
          errorPath === undefined ? undefined :
            isArray(errorPath) ? errorPath :
            errorPath.split("/")
        )
      )
      error.jsonUrl = getRootObjectInfo(jsonInfo).url
    }
  }
  return error
}

const splitPathAndReverse = (p: string | undefined) =>
  p === undefined ? undefined : Array.from(flatMap(p.split("/"), s => s.split("\\"))).reverse()

const isSubPath = (mainPath: ReadonlyArray<string> | undefined, subPath: ReadonlyArray<string>) =>
  mainPath !== undefined &&
  mainPath.length > subPath.length &&
  subPath.every((s, i) => mainPath[i] === s)

const createErrorProcessor = <T extends NodeError<T>>(suppression: Suppression | undefined) => {

  const isSuppressed = suppression === undefined ?
    () => false :
    (error: T): boolean => {
      const urlReversed = splitPathAndReverse(error.url)
      const jsonUrlReversed = splitPathAndReverse(error.url)

      // create dummy object which have the `error.title` path and `error.path`.
      // we use the dummy object to test against suppression path expressions.
      const oPath = createDummyByPath(error.title)
      const jPath = createDummyByPath(error.path)

      // See error codes:
      // https://github.com/Azure/oav/blob/master/documentation/oav-errors-reference.md#errors-index
      return suppression.directive.some(s => {

        // error code
        if (error.code !== s.suppress) {
          return false
        }

        // file path
        const fromReversed = splitPathAndReverse(s.from)
        if (fromReversed !== undefined) {
          const match =
            isSubPath(urlReversed, fromReversed) ||
            isSubPath(jsonUrlReversed, fromReversed)
          if (!match) {
            return false
          }
        }

        const where = s.where
        if (where !== undefined) {
          // TODO: JSONPath: https://www.npmjs.com/package/jsonpath using jp.nodes() function.
          const match =
            jp.value(oPath, where) ||
            jp.value(jPath, where)
          if (!match) {
            return false
          }
        }

        return true
      })
    }

  const one = (error: T): T | undefined => {
    error = addFileInfo(error)
    if (isSuppressed(error)) {
      return undefined
    }
    setMutableProperty(error, "errors", multiple(error.errors))
    setMutableProperty(error, "inner", multiple(error.inner))
    return error
  }

  const multiple = (errors: T[] | undefined) =>
    errors === undefined ? undefined : Array.from(filterMap(errors, one))

  return multiple
}
