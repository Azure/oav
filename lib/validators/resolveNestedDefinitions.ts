// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import {
  DefinitionsObject,
  SwaggerObject,
  ParameterObject,
  SchemaObject,
  ResponseObject,
  PathItemObject,
  OperationObject,
  ResponseSchemaObject
} from "yasway"
import * as uuid from "uuid"
import {
  arrayMap,
  propertySetMap,
  stringMapMap,
  stringMapMerge,
  getInfo,
  getPath
} from "@ts-common/source-map"
import { PartialFactory } from "@ts-common/property-set"

const skipUndefined = <T>(f: (v: T) => T): ((v: T|undefined) => T|undefined) =>
  (v) => v === undefined ? undefined : f(v)

export function resolveNestedDefinitions(spec: SwaggerObject): SwaggerObject {

  const extraDefinitions: DefinitionsObject = {}

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
        return schemaObject
    }

    // here schemaObject.type is one of {undefined, "object", "array"}.
    // Because it's a nested schema object, we create an extra definition and return a reference.
    const result = resolveSchemaObject(schemaObject)
    const info = getInfo(result)
    const suffix = info === undefined ? uuid.v4() : getPath(info).join(".")
    const definitionName = "generated" + suffix
    if (result !== undefined) {
      extraDefinitions[definitionName] = result
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
        properties: properties => stringMapMap(properties, resolveNestedSchemaObject),
        additionalProperties: additionalProperties =>
          additionalProperties === undefined || typeof additionalProperties !== "object" ?
            additionalProperties :
            resolveNestedSchemaObject(additionalProperties),
        items: skipUndefined(resolveNestedSchemaObject),
        allOf: skipUndefined(resolveSchemaObjectArray),
        anyOf: skipUndefined(resolveSchemaObjectArray),
        oneOf: skipUndefined(resolveSchemaObjectArray),
      }
    )

  const resolveParameterObject = (parameterObject: ParameterObject) =>
    propertySetMap(parameterObject, { schema: skipUndefined(resolveSchemaObject) })

  const resolveResponseObject = (responseObject: ResponseObject) =>
    propertySetMap(
      responseObject,
      {
        schema: (schema?: ResponseSchemaObject) =>
          schema === undefined || schema.type === "file" ?
            schema :
            resolveSchemaObject(schema)
      }
    )

  const resolveParameterArray = (parametersTracked: ParameterObject[]) =>
    arrayMap(parametersTracked, resolveParameterObject) as ParameterObject[]

  const resolveOperationObject = (operationObject: OperationObject|undefined) =>
    operationObject === undefined ?
      undefined :
      propertySetMap<OperationObject>(
        operationObject,
        {
          parameters: skipUndefined(resolveParameterArray),
          responses: responses => stringMapMap(responses, resolveResponseObject)
        })

  // transformations for Open API 2.0
  const swaggerObjectTransformation: PartialFactory<SwaggerObject> = {
    definitions: definitions => stringMapMap(definitions, resolveSchemaObject),
    parameters: parameters => stringMapMap(parameters, resolveParameterObject),
    responses: responses => stringMapMap(responses, resolveResponseObject),
    paths: paths => stringMapMap(
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
        }
      )
    )
  }

  // create extra definitions and the temporary spec
  const temp = propertySetMap(spec, swaggerObjectTransformation)

  const mergeDefinitions = (definitions: DefinitionsObject|undefined) =>
    definitions === undefined ? extraDefinitions : stringMapMerge(definitions, extraDefinitions)

  // merge definitions and extraDefinitions.
  return propertySetMap(temp, { definitions: mergeDefinitions })
}
