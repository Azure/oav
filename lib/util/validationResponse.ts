import * as pointer from 'json-pointer'
import { Error } from "./error"

export class ValidateResponse {

  seralize() {
    const result: { ['json-path']?: any } = {}
    for (const prop in this) {
      if (this[prop] !== null && this[prop] !== undefined) {
        if (prop === 'jsonpath')
          result['json-path'] = this[prop]
      }
    }
    return result
  }

  constructErrors(
    validationError: Error, specPath: any, providerNamespace: any): any[] {
    const self = this
    if (!validationError) {
      throw new Error('validationError cannot be null or undefined.')
    }
    return validationError.innerErrors.map(error => {
      const e: any = {
        validationCategory: 'SwaggerViolation',
        providerNamespace: providerNamespace,
        type: 'error',
        inner: error.inner
      }
      if (error.code && (self.mapper as any)[error.code]) {
        e.code = error.code
        e.id = (self.mapper as any)[error.code]
        e.message = error.message
      } else {
        e.code = 'SWAGGER_SCHEMA_VALIDATION_ERROR'
        e.message = validationError.message
        e.id = (self.mapper as any)[e.code]
        e.inner = error
      }
      if (error.path && error.path.length) {
        let paths = [specPath + '#'].concat(error.path)
        let jsonpath = pointer.compile(paths)
        e.jsonref = jsonpath
        e['json-path'] = pointer.unescape(jsonpath)
      }
      return e
    })
  }

  sanitizeWarnings(warnings: any[]): any[] {
    if (!warnings) {
      throw new Error('validationError cannot be null or undefined.')
    }
    return warnings.filter(warning => warning.code
      && warning.code !== 'EXTRA_REFERENCE_PROPERTIES'
      && warning.code !== 'UNUSED_DEFINITION')
  }

  mapper = {
    'SWAGGER_SCHEMA_VALIDATION_ERROR': 'M6000',
    'INVALID_PARAMETER_COMBINATION': 'M6001',
    'MULTIPLE_BODY_PARAMETERS': 'M6002',
    'DUPLICATE_PARAMETER': 'M6003',
    'DUPLICATE_OPERATIONID': 'M6004',
    'MISSING_PATH_PARAMETER_DEFINITION': 'M6005',
    'EMPTY_PATH_PARAMETER_DECLARATION': 'M6006',
    'EQUIVALENT_PATH': 'M6008',
    'UNRESOLVABLE_REFERENCE': 'M6010',
    'INVALID_TYPE': 'M6011',
    'CIRCULAR_INHERITANCE': 'M6012',
    'OBJECT_MISSING_REQUIRED_PROPERTY': 'M6013',
    'OBJECT_MISSING_REQUIRED_PROPERTY_DEFINITION': 'M6014',
    'ENUM_MISMATCH': 'M6015',
    'ENUM_CASE_MISMATCH': 'M6016'
  }
}

export const validateResponse = new ValidateResponse()
