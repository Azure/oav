// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var pointer = require('json-pointer');
exports = module.exports;


function foo(type, code, message, innerErrors, jsonref, jsonpath, id, validationCategory, providerNamespace, resourceType) {
  this.code = code;
  this.code = code;
  this.message = message;
  this.innerErrors = innerErrors;
  this.jsonref = jsonref;
  this.jsonpath = jsonpath;
  this.id = id;
  this.validationCategory = validationCategory;
  this.providerNamespace = providerNamespace;
  this.resourceType = resourceType;
}

exports.serialize = function seralize() {
  let result = {};
  for (let prop in this) {
    if (this[prop] !== null && this[prop] !== undefined) {
      if (prop === 'jsonpath')
        result['json-path'] = this[prop];
    }
  }
  return result;
}

exports.constructErrors = function constructErrors(validationError, specPath, providerNamespace) {
  if (!validationError) {
    throw new Error('validationError cannot be null or undefined.');
  }
  let result = [];
  validationError.innerErrors.forEach(function (error) {
    let e = {
      validationCategory: 'SwaggerViolation',
      providerNamespace: providerNamespace,
      type: 'error',
      inner: error.inner
    };
    if (error.code && exports.mapper[error.code]) {
      e.code = error.code;
      e.id = exports.mapper[error.code];
      e.message = error.message;
    } else {
      e.code = 'SWAGGER_SCHEMA_VALIDATION_ERROR';
      e.message = validationError.message;
      e.id = exports.mapper[e.code];
      e.inner = error;
    }
    if (error.path && error.path.length) {
      let paths = [specPath + '#'].concat(error.path);
      let jsonpath = pointer.compile(paths);
      e.jsonref = jsonpath;
      e['json-path'] = pointer.unescape(jsonpath);
    }
    result.push(e);
  });
  return result;
};

exports.sanitizeWarnings = function sanitizeWarnings(warnings) {
  if (!warnings) {
    throw new Error('validationError cannot be null or undefined.');
  }
  let result = [];
  warnings.forEach(function(warning) {
    if (warning.code && warning.code !== 'EXTRA_REFERENCE_PROPERTIES' && warning.code !== 'UNUSED_DEFINITION') {
      result.push(warning);
    }
  });
  return result;
}
exports.mapper = {
  'SWAGGER_SCHEMA_VALIDATION_ERROR': 'M6000',
  'INVALID_PARAMETER_COMBINATION': 'M6001',
  'MULTIPLE_BODY_PARAMETERS': 'M6002',
  'DUPLICATE_PARAMETER': 'M6003',
  'DUPLICATE_OPERATIONID': 'M6004',
  'MISSING_PATH_PARAMETER_DEFINITION': 'M6005',
  'EMPTY_PATH_PARAMETER_DECLARATION': 'M6006',
  'MISSING_PATH_PARAMETER_DEFINITION': 'M6007',
  'EQUIVALENT_PATH': 'M6008',
  'DUPLICATE_PARAMETER': 'M6009',
  'UNRESOLVABLE_REFERENCE': 'M6010',
  'INVALID_TYPE': 'M6011',
  'CIRCULAR_INHERITANCE': 'M6012',
  'OBJECT_MISSING_REQUIRED_PROPERTY': 'M6013',
  'OBJECT_MISSING_REQUIRED_PROPERTY_DEFINITION': 'M6014',
  'ENUM_MISMATCH': 'M6015'
};