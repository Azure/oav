// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { Severity } from "./severity"
import _ from "lodash"
import { FilePosition } from "@ts-common/source-map"
import { flatMap, fold } from "@ts-common/iterator"
import { errorsAddFileInfo } from "./errorFileInfo"

/**
 * @class
 * Error that results from validations.
 */
export class ValidationError {
  /**
   *
   * @param name Validation Error Name
   * @param severity The
   */
  constructor(
    public readonly name: string,
    public readonly severity: Severity
  ) {}
}

const validationErrorEntry = (id: string, severity: Severity): [string, ValidationError] =>
  [id, new ValidationError(id, severity)]

export const errorConstants = new Map<string, ValidationError>([
  validationErrorEntry("INVALID_TYPE", Severity.Critical),
  validationErrorEntry("INVALID_FORMAT", Severity.Critical),
  validationErrorEntry("ENUM_MISMATCH", Severity.Critical),
  validationErrorEntry("ENUM_CASE_MISMATCH", Severity.Error),
  validationErrorEntry("PII_MISMATCH", Severity.Warning),
  validationErrorEntry("ANY_OF_MISSING", Severity.Critical),
  validationErrorEntry("ONE_OF_MISSING", Severity.Critical),
  validationErrorEntry("ONE_OF_MULTIPLE", Severity.Critical),
  validationErrorEntry("NOT_PASSED", Severity.Critical),
  // arrays
  validationErrorEntry("ARRAY_LENGTH_SHORT", Severity.Critical),
  validationErrorEntry("ARRAY_LENGTH_LONG", Severity.Critical),
  validationErrorEntry("ARRAY_UNIQUE", Severity.Critical),
  validationErrorEntry("ARRAY_ADDITIONAL_ITEMS", Severity.Critical),
  // numeric
  validationErrorEntry("MULTIPLE_OF", Severity.Critical),
  validationErrorEntry("MINIMUM", Severity.Critical),
  validationErrorEntry("MINIMUM_EXCLUSIVE", Severity.Critical),
  validationErrorEntry("MAXIMUM", Severity.Critical),
  validationErrorEntry("MAXIMUM_EXCLUSIVE", Severity.Critical),
  // objects
  validationErrorEntry("OBJECT_PROPERTIES_MINIMUM", Severity.Critical),
  validationErrorEntry("OBJECT_PROPERTIES_MAXIMUM", Severity.Critical),
  validationErrorEntry("OBJECT_MISSING_REQUIRED_PROPERTY", Severity.Critical),
  validationErrorEntry("OBJECT_ADDITIONAL_PROPERTIES", Severity.Critical),
  validationErrorEntry("OBJECT_DEPENDENCY_KEY", Severity.Warning),
  // string
  validationErrorEntry("MIN_LENGTH", Severity.Critical),
  validationErrorEntry("MAX_LENGTH", Severity.Critical),
  validationErrorEntry("PATTERN", Severity.Critical),
  // operation
  validationErrorEntry("OPERATION_NOT_FOUND_IN_CACHE", Severity.Critical),
  validationErrorEntry(
    "OPERATION_NOT_FOUND_IN_CACHE_WITH_VERB",
    Severity.Critical
  ),
  validationErrorEntry(
    "OPERATION_NOT_FOUND_IN_CACHE_WITH_API",
    Severity.Critical
  ),
  validationErrorEntry(
    "OPERATION_NOT_FOUND_IN_CACHE_WITH_PROVIDER",
    Severity.Critical
  ),
  validationErrorEntry("MULTIPLE_OPERATIONS_FOUND", Severity.Critical),
  // others
  validationErrorEntry("INVALID_RESPONSE_HEADER", Severity.Critical),
  validationErrorEntry("INVALID_RESPONSE_CODE", Severity.Critical),
  validationErrorEntry("INVALID_RESPONSE_BODY", Severity.Critical),
  validationErrorEntry("INVALID_REQUEST_PARAMETER", Severity.Critical),
  validationErrorEntry("INVALID_CONTENT_TYPE", Severity.Error)
])

/**
 * Gets the severity from an error code. If the code is unknown assume critical.
 */
export const errorCodeToSeverity = (code: string): Severity => {
  const errorConstant = errorConstants.get(code)
  return errorConstant ? errorConstant.severity : Severity.Critical
}

export interface NodeError<T extends NodeError<T>> {
  code?: string
  path?: string | string[]
  similarPaths?: string[]
  errors?: T[]
  in?: string
  name?: string
  params?: Array<unknown>
  inner?: T[]
  title?: string
  message?: string

  position?: FilePosition
  url?: string
}

export interface ValidationResult<T extends NodeError<T>> {
  readonly requestValidationResult: T
  readonly responseValidationResult: T
}

/**
 * Serializes validation results into a flat array.
 */
export function processValidationErrors<
  V extends ValidationResult<T>,
  T extends NodeError<T>
>(rawValidation: V): V {
  const requestSerializedErrors: T[] = serializeErrors(
    rawValidation.requestValidationResult,
    []
  )
  const responseSerializedErrors: T[] = serializeErrors(
    rawValidation.responseValidationResult,
    []
  )

  rawValidation.requestValidationResult.errors = errorsAddFileInfo(requestSerializedErrors)
  rawValidation.responseValidationResult.errors = errorsAddFileInfo(responseSerializedErrors)

  return rawValidation
}

/**
 * Serializes error tree
 */
export function serializeErrors<T extends NodeError<T>>(
  node: T,
  path: Array<unknown>
): T[] {

  if (isLeaf(node)) {
    if (isTrueError(node)) {
      if (node.path) {
        node.path = consolidatePath(path, node.path).join("/")
      }
      return [node]
    }
    return []
  }

  if (node.path) {
    // in this case the path will be set to the url instead of the path to the property
    if (node.code === "INVALID_REQUEST_PARAMETER" && node.in === "body") {
      node.path = []
    } else if (
      (node.in === "query" || node.in === "path") &&
      node.path[0] === "paths" &&
      node.name
    ) {
      // in this case we will want to normalize the path with the uri and the paramter name
      node.path = [node.path[1], node.name]
    }
    path = consolidatePath(path, node.path)
  }

  const serializedErrors = Array.from(flatMap(
    node.errors,
    validationError => serializeErrors(validationError, path)
  ))

  const serializedInner = fold(
    node.inner,
    (acc, validationError) => {
      const errs = serializeErrors(validationError, path)
      errs.forEach(err => {
        const similarErr = acc.find(el => areErrorsSimilar(err, el))
        if (similarErr && similarErr.path) {
          if (!similarErr.similarPaths) {
            similarErr.similarPaths = []
          }
          similarErr.similarPaths.push(err.path as string)
        } else {
          acc.push(err)
        }
      })
      return acc
    },
    new Array<T>()
  )

  if (isDiscriminatorError(node)) {
    if (node.path) {
      node.path = consolidatePath(path, node.path).join("/")
    }

    node.inner = serializedInner
    return [node]
  }
  return [...serializedErrors, ...serializedInner]
}

/**
 * Checks if two errors are the same except their path.
 */
function areErrorsSimilar<T extends NodeError<T>>(node1: T, node2: T) {
  if (
    node1.code !== node2.code ||
    node1.title !== node2.title ||
    node1.message !== node2.message ||
    !arePathsSimilar(node1.path, node2.path)
  ) {
    return false
  }

  if (!node1.inner && !node2.inner) {
    return true
  }

  if (
    !node1.inner ||
    !node2.inner ||
    node1.inner.length !== node2.inner.length
  ) {
    return false
  }

  for (let i = 0; i < node1.inner.length; i++) {
    if (!areErrorsSimilar(node1.inner[i], node2.inner[i])) {
      return false
    }
  }
  return true
}

/**
 * Checks if paths differ only in indexes
 */
const arePathsSimilar = (
  path1: string | string[] | undefined,
  path2: string | string[] | undefined
) => {
  if (path1 === path2) {
    return true
  }
  if (path1 === undefined || path2 === undefined) {
    return false
  }

  const p1 = Array.isArray(path1) ? path1 : path1.split("/")
  const p2 = Array.isArray(path2) ? path2 : path2.split("/")

  return _.xor(p1, p2).every(v => Number.isInteger(+v))
}

function isDiscriminatorError<T extends NodeError<T>>(node: T) {
  return node.code === "ONE_OF_MISSING" && node.inner && node.inner.length > 0
}

function isTrueError<T extends NodeError<T>>(node: T): boolean {
  // this is necessary to filter out extra errors coming from doing the ONE_OF transformation on
  // the models to allow "null"
  return !(
    node.code === "INVALID_TYPE" &&
    node.params &&
    node.params[0] === "null"
  )
}

function isLeaf<T extends NodeError<T>>(node: T): boolean {
  return !node.errors && !node.inner
}

/**
 * Unifies a suffix path with a root path.
 */
function consolidatePath(
  path: Array<unknown>,
  suffixPath: string | string[]
): Array<unknown> {
  let newSuffixIndex = 0
  let overlapIndex = path.lastIndexOf(suffixPath[newSuffixIndex])
  let previousIndex = overlapIndex

  if (overlapIndex === -1) {
    return path.concat(suffixPath)
  }

  for (
    newSuffixIndex = 1;
    newSuffixIndex < suffixPath.length;
    ++newSuffixIndex
  ) {
    previousIndex = overlapIndex
    overlapIndex = path.lastIndexOf(suffixPath[newSuffixIndex])
    if (overlapIndex === -1 || overlapIndex !== previousIndex + 1) {
      break
    }
  }
  let newPath: Array<unknown> = []
  if (newSuffixIndex === suffixPath.length) {
    // if all elements are contained in the existing path, nothing to do.
    newPath = path.slice(0)
  } else if (overlapIndex === -1 && previousIndex === path.length - 1) {
    // if we didn't find element at x in the previous path and element at x -1 is the last one in
    // the path, append everything from x
    newPath = path.concat(suffixPath.slice(newSuffixIndex))
  } else {
    // otherwise it is not contained at all, so concat everything.
    newPath = path.concat(suffixPath)
  }

  return newPath
}
