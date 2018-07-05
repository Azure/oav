// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { Severity } from "./severity"

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

export const errorConstants: Map<string, ValidationError> = new Map<
  string,
  ValidationError
>();
errorConstants.set(
  "INVALID_TYPE",
  new ValidationError("INVALID_TYPE", Severity.Critical)
);
errorConstants.set(
  "INVALID_FORMAT",
  new ValidationError("INVALID_FORMAT", Severity.Critical)
);
errorConstants.set(
  "ENUM_MISMATCH",
  new ValidationError("ENUM_MISMATCH", Severity.Critical)
);
errorConstants.set(
  "ENUM_CASE_MISMATCH",
  new ValidationError("ENUM_CASE_MISMATCH", Severity.Error)
);
errorConstants.set(
  "PII_MISMATCH",
  new ValidationError("PII_MISMATCH", Severity.Warning)
);

errorConstants.set(
  "ANY_OF_MISSING",
  new ValidationError("ANY_OF_MISSING", Severity.Critical)
);
errorConstants.set(
  "ONE_OF_MISSING",
  new ValidationError("ONE_OF_MISSING", Severity.Critical)
);
errorConstants.set(
  "ONE_OF_MULTIPLE",
  new ValidationError("ONE_OF_MULTIPLE", Severity.Critical)
);
errorConstants.set(
  "NOT_PASSED",
  new ValidationError("NOT_PASSED", Severity.Critical)
);

// arrays
errorConstants.set(
  "ARRAY_LENGTH_SHORT",
  new ValidationError("ARRAY_LENGTH_SHORT", Severity.Critical)
);
errorConstants.set(
  "ARRAY_LENGTH_LONG",
  new ValidationError("ARRAY_LENGTH_LONG", Severity.Critical)
);
errorConstants.set(
  "ARRAY_UNIQUE",
  new ValidationError("ARRAY_UNIQUE", Severity.Critical)
);
errorConstants.set(
  "ARRAY_ADDITIONAL_ITEMS",
  new ValidationError("ARRAY_ADDITIONAL_ITEMS", Severity.Critical)
);

// numeric
errorConstants.set(
  "MULTIPLE_OF",
  new ValidationError("MULTIPLE_OF", Severity.Critical)
);
errorConstants.set(
  "MINIMUM",
  new ValidationError("MINIMUM", Severity.Critical)
);
errorConstants.set(
  "MINIMUM_EXCLUSIVE",
  new ValidationError("MINIMUM_EXCLUSIVE", Severity.Critical)
);
errorConstants.set(
  "MAXIMUM",
  new ValidationError("MAXIMUM", Severity.Critical)
);
errorConstants.set(
  "MAXIMUM_EXCLUSIVE",
  new ValidationError("MAXIMUM_EXCLUSIVE", Severity.Critical)
);

// objects
errorConstants.set(
  "OBJECT_PROPERTIES_MINIMUM",
  new ValidationError("OBJECT_PROPERTIES_MINIMUM", Severity.Critical)
);
errorConstants.set(
  "OBJECT_PROPERTIES_MAXIMUM",
  new ValidationError("OBJECT_PROPERTIES_MAXIMUM", Severity.Critical)
);
errorConstants.set(
  "OBJECT_MISSING_REQUIRED_PROPERTY",
  new ValidationError("OBJECT_MISSING_REQUIRED_PROPERTY", Severity.Critical)
);
errorConstants.set(
  "OBJECT_ADDITIONAL_PROPERTIES",
  new ValidationError("OBJECT_ADDITIONAL_PROPERTIES", Severity.Critical)
);
errorConstants.set(
  "OBJECT_DEPENDENCY_KEY",
  new ValidationError("OBJECT_DEPENDENCY_KEY", Severity.Warning)
);

// string
errorConstants.set(
  "MIN_LENGTH",
  new ValidationError("MIN_LENGTH", Severity.Critical)
);
errorConstants.set(
  "MAX_LENGTH",
  new ValidationError("MAX_LENGTH", Severity.Critical)
);
errorConstants.set(
  "PATTERN",
  new ValidationError("PATTERN", Severity.Critical)
);

// operation
errorConstants.set(
  "OPERATION_NOT_FOUND_IN_CACHE",
  new ValidationError("OPERATION_NOT_FOUND_IN_CACHE", Severity.Critical)
);
errorConstants.set(
  "OPERATION_NOT_FOUND_IN_CACHE_WITH_VERB",
  new ValidationError(
    "OPERATION_NOT_FOUND_IN_CACHE_WITH_VERB",
    Severity.Critical
  )
);
errorConstants.set(
  "OPERATION_NOT_FOUND_IN_CACHE_WITH_API",
  new ValidationError(
    "OPERATION_NOT_FOUND_IN_CACHE_WITH_API",
    Severity.Critical
  )
);
errorConstants.set(
  "OPERATION_NOT_FOUND_IN_CACHE_WITH_PROVIDER",
  new ValidationError(
    "OPERATION_NOT_FOUND_IN_CACHE_WITH_PROVIDER",
    Severity.Critical
  )
);
errorConstants.set(
  "MULTIPLE_OPERATIONS_FOUND",
  new ValidationError("MULTIPLE_OPERATIONS_FOUND", Severity.Critical)
);

// others
errorConstants.set(
  "INVALID_RESPONSE_HEADER",
  new ValidationError("INVALID_RESPONSE_HEADER", Severity.Critical)
);
errorConstants.set(
  "INVALID_RESPONSE_CODE",
  new ValidationError("INVALID_RESPONSE_CODE", Severity.Critical)
);
errorConstants.set(
  "INVALID_RESPONSE_BODY",
  new ValidationError("INVALID_RESPONSE_BODY", Severity.Critical)
);
errorConstants.set(
  "INVALID_REQUEST_PARAMETER",
  new ValidationError("INVALID_REQUEST_PARAMETER", Severity.Critical)
);
errorConstants.set(
  "INVALID_CONTENT_TYPE",
  new ValidationError("INVALID_CONTENT_TYPE", Severity.Error)
);

/**
 * Gets the severity from an error code. If the code is unknown assume critical.
 */
export const errorCodeToSeverity = (code: string): Severity => {
  const errorConstant = errorConstants.get(code);
  return errorConstant ? errorConstant.severity : Severity.Critical;
};

/**
 * Serializes validation results into a flat array.
 */
export const processValidationErrors = (rawValidation: any): any => {
  const requestSerializedErrors: any[] = [];
  const responseSerializedErrors: any[] = [];

  serializeErrors(
    rawValidation.requestValidationResult,
    requestSerializedErrors,
    []
  );
  serializeErrors(
    rawValidation.responseValidationResult,
    responseSerializedErrors,
    []
  );

  rawValidation.requestValidationResult.errors = requestSerializedErrors;
  rawValidation.responseValidationResult.errors = responseSerializedErrors;

  return rawValidation;
};

/**
 * Serializes error tree
 */
export const serializeErrors = (node: any, serializedErrors: any, path: any) => {
  if (isLeaf(node)) {
    if (isTrueError(node)) {
      if (node.path) {
        node.path = consolidatePath(path, node.path).join("/");
      }
      serializedErrors.push(node);
    }
    return;
  }

  if (node.path) {
    // in this case the path will be set to the url instead of the path to the property
    if (node.code === "INVALID_REQUEST_PARAMETER" && node.in === "body") {
      node.path = [];
    } else if (
      (node.in === "query" || node.in === "path") &&
      node.path[0] === "paths" &&
      node.name
    ) {
      // in this case we will want to normalize the path with the uri and the paramter name
      node.path = [node.path[1], node.name];
    }
    path = consolidatePath(path, node.path);
  }
  if (node.errors) {
    node.errors.map((validationError: any) => {
      serializeErrors(validationError, serializedErrors, path);
    });
  }

  if (node.inner) {
    node.inner.map((validationError: any) => {
      serializeErrors(validationError, serializedErrors, path);
    });
  }
};

const isTrueError = (node: any) => {
  // this is necessary to filter out extra errors coming from doing the ONE_OF transformation on
  // the models to allow "null"
  if (
    node.code === "INVALID_TYPE" &&
    node.params &&
    node.params[0] === "null"
  ) {
    return false;
  } else {
    return true;
  }
};

const isLeaf = (node: any) => {
  return !node.errors && !node.inner;
};

const consolidatePath = (path: any, suffixPath: any) => {
  let newSuffixIndex = 0;
  let overlapIndex = path.lastIndexOf(suffixPath[newSuffixIndex]);
  let previousIndex = overlapIndex;

  if (overlapIndex === -1) {
    return path.concat(suffixPath);
  }

  for (
    newSuffixIndex = 1;
    newSuffixIndex < suffixPath.length;
    ++newSuffixIndex
  ) {
    previousIndex = overlapIndex;
    overlapIndex = path.lastIndexOf(suffixPath[newSuffixIndex]);
    if (overlapIndex === -1 || overlapIndex !== previousIndex + 1) {
      break;
    }
  }
  let newPath = [];
  if (newSuffixIndex === suffixPath.length) {
    // if all elements are contained in the existing path, nothing to do.
    newPath = path.slice(0);
  } else if (overlapIndex === -1 && previousIndex === path.length - 1) {
    // if we didn't find element at x in the previous path and element at x -1 is the last one in
    // the path, append everything from x
    newPath = path.concat(suffixPath.slice(newSuffixIndex));
  } else {
    // otherwise it is not contained at all, so concat everything.
    newPath = path.concat(suffixPath);
  }

  return newPath;
};
