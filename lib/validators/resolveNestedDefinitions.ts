// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import {
  DefinitionsObject,
  SwaggerObject,
  ParameterObject,
  SchemaObject,
  ResponseObject,
  PathItemObject,
  OperationObject
} from "yasway"
import * as uuid from "uuid"
import { arrayMap, propertySetMap, stringMapMap, stringMapMerge } from "@ts-common/source-map"
import { PartialFactory } from "@ts-common/property-set"

const skipUndefined = <T>(f: (v: T) => T): ((v: T|undefined) => T|undefined) =>
  (v) => v === undefined ? undefined : f(v)

export function resolveNestedDefinitions(spec: SwaggerObject): SwaggerObject {

  const newDefinitions: DefinitionsObject = {}

  // a function to resolve nested schema objects
  const resolveNestedSchemaObject = (schemaObject: SchemaObject) => {
    // ignore references
    if (schemaObject.$ref !== undefined) {
      return schemaObject
    }

    // ignore primitive types
    switch (schemaObject.type) {
      case "integer":
      case "number":
      case "string":
      case "boolean":
      case "null":
      case "file":
        return schemaObject
    }

    // here schemaObject.type is one of {undefined, "object", "array"}.
    // Because it's a nested schema object, we create a new definition and return a reference.
    const result = resolveSchemaObject(schemaObject)
    const definitionName = uuid.v4()
    if (result !== undefined) {
      newDefinitions[definitionName] = result
    }
    return { $ref: `#/definitions/${encodeURIComponent(definitionName)}` }
  }

  // a function to resolve SchemaObject array
  const resolveSchemaObjectArray = (schemaObjectArray: SchemaObject[]) =>
    arrayMap(schemaObjectArray, resolveNestedSchemaObject) as SchemaObject[]

  // a function to resolve SchemaObject (top-level and nested)
  const resolveSchemaObject = (schemaObject: SchemaObject): SchemaObject =>
    propertySetMap<SchemaObject>(
      schemaObject,
      {
        properties: properties => properties === undefined ?
          undefined :
          stringMapMap(properties, resolveNestedSchemaObject),
        additionalProperties: additionalProperties =>
          additionalProperties === undefined ?
            undefined :
          typeof additionalProperties === "object" ?
            resolveNestedSchemaObject(additionalProperties) :
            additionalProperties,
        items: skipUndefined(resolveNestedSchemaObject),
        allOf: skipUndefined(resolveSchemaObjectArray),
        anyOf: skipUndefined(resolveSchemaObjectArray),
        oneOf: skipUndefined(resolveSchemaObjectArray),
      })

  const resolveParameterObject = (parameterObject: ParameterObject) =>
    propertySetMap(parameterObject, { schema: skipUndefined(resolveSchemaObject) })

  const resolveResponseObject = (responseObject: ResponseObject) =>
    propertySetMap(responseObject, { schema: skipUndefined(resolveSchemaObject) })

  const resolveParameterArray = (parametersTracked: ParameterObject[]) =>
    arrayMap(parametersTracked, resolveParameterObject) as ParameterObject[]

  const resolveOperationObject = (operationObject: OperationObject|undefined) =>
    operationObject === undefined ?
      undefined :
      propertySetMap<OperationObject>(
        operationObject,
        {
          parameters: skipUndefined(resolveParameterArray),
          responses: responses => responses === undefined ?
            undefined :
            stringMapMap(responses, resolveResponseObject)
        })

  // transformations for Open API 2.0
  const swaggerObjectTransformation: PartialFactory<SwaggerObject> = {
    definitions: definitions => definitions === undefined ?
      undefined :
      stringMapMap(definitions, resolveSchemaObject),
    parameters: parameters => parameters === undefined ?
      undefined :
      stringMapMap(parameters, resolveParameterObject),
    responses: responses => responses === undefined ?
      undefined :
      stringMapMap(responses, resolveResponseObject),
    paths: paths => paths === undefined ?
      undefined :
      stringMapMap(
        paths,
        path => propertySetMap<PathItemObject>(
          path,
          {
            get: resolveOperationObject,
            put: resolveOperationObject,
            post: resolveOperationObject,
            delete: resolveOperationObject,
            options: resolveOperationObject,
            head: resolveOperationObject,
            patch: resolveOperationObject,
            parameters: skipUndefined(resolveParameterArray)
          }))
  }

  const temp = propertySetMap(spec, swaggerObjectTransformation)

  // resolve the given OpenAPI document.
  return propertySetMap(temp, {
    definitions: (definitions: DefinitionsObject|undefined) => definitions === undefined ?
      newDefinitions : stringMapMerge(definitions, newDefinitions)
  })
}
