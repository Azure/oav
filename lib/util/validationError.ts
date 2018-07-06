// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { Severity } from "./severity"
import { Unknown } from "./unknown"

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
  ) {
  }
}

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
  validationErrorEntry("OPERATION_NOT_FOUND_IN_CACHE_WITH_VERB", Severity.Critical),
  validationErrorEntry("OPERATION_NOT_FOUND_IN_CACHE_WITH_API", Severity.Critical),
  validationErrorEntry("OPERATION_NOT_FOUND_IN_CACHE_WITH_PROVIDER", Severity.Critical),
  validationErrorEntry("MULTIPLE_OPERATIONS_FOUND", Severity.Critical),
  // others
  validationErrorEntry("INVALID_RESPONSE_HEADER", Severity.Critical),
  validationErrorEntry("INVALID_RESPONSE_CODE", Severity.Critical),
  validationErrorEntry("INVALID_RESPONSE_BODY", Severity.Critical),
  validationErrorEntry("INVALID_REQUEST_PARAMETER", Severity.Critical),
  validationErrorEntry("INVALID_CONTENT_TYPE", Severity.Error),
])

/**
 * Gets the severity from an error code. If the code is unknown assume critical.
 */
export function errorCodeToSeverity(code: string): Severity {
  const errorConstant = errorConstants.get(code)
  return errorConstant ? errorConstant.severity : Severity.Critical
}

export interface ValidationResult {
  readonly requestValidationResult: Node
  readonly responseValidationResult: Node
}

/**
 * Serializes validation results into a flat array.
 */
export function processValidationErrors(rawValidation: ValidationResult): ValidationResult {
  const requestSerializedErrors: Node[] = []
  const responseSerializedErrors: Node[] = []

  serializeErrors(
    rawValidation.requestValidationResult,
    requestSerializedErrors,
    []
  )
  serializeErrors(
    rawValidation.responseValidationResult,
    responseSerializedErrors,
    []
  )

  rawValidation.requestValidationResult.errors = requestSerializedErrors
  rawValidation.responseValidationResult.errors = responseSerializedErrors

  return rawValidation
};

export interface Node {
  path: string|string[]
  errors: Node[]
  code: Unknown
  in: Unknown
  name: string
  inner: Node[]
  params: Unknown[]
}

/**
 * Serializes error tree
 */
export function serializeErrors(node: Node, serializedErrors: Unknown[], path: Unknown[]) {
  if (isLeaf(node)) {
    if (isTrueError(node)) {
      if (node.path) {
        node.path = consolidatePath(path, node.path).join("/")
      }
      serializedErrors.push(node)
    }
    return
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
  if (node.errors) {
    node.errors.map(validationError => {
      serializeErrors(validationError, serializedErrors, path);
    })
  }

  if (node.inner) {
    node.inner.map(validationError => {
      serializeErrors(validationError, serializedErrors, path)
    })
  }
}

function validationErrorEntry(id: string, severity: Severity): [string, ValidationError] {
  return [id, new ValidationError(id, severity)]
}

function isTrueError(node: Node) {
  // this is necessary to filter out extra errors coming from doing the ONE_OF transformation on
  // the models to allow "null"
  if (
    node.code === "INVALID_TYPE" &&
    node.params &&
    node.params[0] === "null"
  ) {
    return false
  } else {
    return true
  }
}

function isLeaf(node: Node) {
  return !node.errors && !node.inner;
};

function consolidatePath(path: Unknown[], suffixPath: string|string[]) {
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
  let newPath = []
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
