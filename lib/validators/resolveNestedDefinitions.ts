// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { PartialFactory } from "@ts-common/property-set"
import {
  arrayMap,
  getInfo,
  getPath,
  propertySetMap,
  stringMapMap,
  stringMapMerge
} from "@ts-common/source-map"
import { MutableStringMap } from "@ts-common/string-map"
import { pathToPtr } from "json-refs"
import * as uuid from "uuid"
import {
  DefinitionsObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ResponseObject,
  ResponseSchemaObject,
  SchemaObject,
  SwaggerObject
} from "yasway"

import { generatedPrefix } from "./cloudError"
import {
  getSchemaObjectInfo,
  setSchemaInfo,
  setSchemaTitle
} from "./specTransformer"

const skipIfUndefined = <T>(
  f: (v: T) => T
): ((v: T | undefined) => T | undefined) => v =>
  v !== undefined ? f(v) : undefined

export function resolveNestedDefinitions(spec: SwaggerObject): SwaggerObject {
  const generatedDefinitions: MutableStringMap<SchemaObject> = {}

  // a function to resolve nested schema objects
  const resolveNestedSchemaObject = (schemaObject: SchemaObject) => {
    // ignore references
    if (schemaObject.$ref !== undefined) {
      setSchemaTitle(schemaObject)
      return schemaObject
    }

    // ignore primitive types
    switch (schemaObject.type) {
      case "integer":
      case "number":
      case "string":
      case "boolean":
      case "null":
        setSchemaTitle(schemaObject)
        return schemaObject
    }

    // here schemaObject.type is one of {undefined, "object", "array"}.
    // Because it's a nested schema object, we create an extra definition and return a reference.
    const result = resolveSchemaObject(schemaObject)
    const info = getInfo(result)
    const suffix = info === undefined ? uuid.v4() : getPath(info).join(".")
    const definitionName = `${generatedPrefix}nested.${suffix}`
    if (result !== undefined) {
      generatedDefinitions[definitionName] = result
    }
    const refResult = { $ref: pathToPtr(["definitions", definitionName]) }
    setSchemaInfo(refResult, getSchemaObjectInfo(schemaObject))
    return refResult
  }
  // a function to resolve SchemaObject array
  const resolveOptionalSchemaObjectArray = (
    schemaObjectArray: ReadonlyArray<SchemaObject> | undefined
  ): ReadonlyArray<SchemaObject> | undefined =>
    schemaObjectArray !== undefined
      ? arrayMap(schemaObjectArray, resolveNestedSchemaObject)
      : undefined

  // a function to resolve SchemaObject (top-level and nested)
  const resolveSchemaObject = (schemaObject: SchemaObject): SchemaObject => {
    const result = propertySetMap<SchemaObject>(schemaObject, {
      properties: properties =>
        stringMapMap(properties, resolveNestedSchemaObject),
      additionalProperties: additionalProperties =>
        additionalProperties === undefined ||
        typeof additionalProperties !== "object"
          ? additionalProperties
          : resolveNestedSchemaObject(additionalProperties),
      items: skipIfUndefined(resolveNestedSchemaObject),
      allOf: resolveOptionalSchemaObjectArray,
      anyOf: resolveOptionalSchemaObjectArray,
      oneOf: resolveOptionalSchemaObjectArray
    })
    setSchemaTitle(result)
    return result
  }

  const resolveParameterObject = (parameterObject: ParameterObject) =>
    propertySetMap(parameterObject, {
      schema: skipIfUndefined(resolveSchemaObject)
    })

  const resolveResponseObject = (responseObject: ResponseObject) =>
    propertySetMap(responseObject, {
      schema: (schema: ResponseSchemaObject | undefined) =>
        schema === undefined || schema.type === "file"
          ? schema
          : resolveSchemaObject(schema)
    })

  const resolveOptionalParameterArray = (
    parameters: ReadonlyArray<ParameterObject> | undefined
  ) =>
    parameters !== undefined
      ? arrayMap(parameters, resolveParameterObject)
      : undefined

  const resolveOptionalOperationObject = (
    operationObject: OperationObject | undefined
  ) =>
    operationObject !== undefined
      ? propertySetMap<OperationObject>(operationObject, {
          parameters: resolveOptionalParameterArray,
          responses: responses => stringMapMap(responses, resolveResponseObject)
        })
      : undefined

  const resolveDefinitions = (definitions: DefinitionsObject | undefined) =>
    stringMapMap(definitions, resolveSchemaObject)

  // transformations for Open API 2.0
  const swaggerObjectTransformation: PartialFactory<SwaggerObject> = {
    definitions: resolveDefinitions,
    parameters: parameters => stringMapMap(parameters, resolveParameterObject),
    responses: responses => stringMapMap(responses, resolveResponseObject),
    paths: paths =>
      stringMapMap(paths, path =>
        propertySetMap<PathItemObject>(path, {
          get: resolveOptionalOperationObject,
          put: resolveOptionalOperationObject,
          post: resolveOptionalOperationObject,
          delete: resolveOptionalOperationObject,
          options: resolveOptionalOperationObject,
          head: resolveOptionalOperationObject,
          patch: resolveOptionalOperationObject,
          parameters: resolveOptionalParameterArray
        })
      )
  }

  // create extra definitions and the temporary spec
  const specWithNoGeneratedDefinitions = propertySetMap(
    spec,
    swaggerObjectTransformation
  )

  const addGeneratedDefinitions = (
    definitions: DefinitionsObject | undefined
  ) => stringMapMerge(definitions, generatedDefinitions)

  // Merge definitions and generatedDefinitions.
  // It should be the last step when all generated definitions are known
  return propertySetMap(specWithNoGeneratedDefinitions, {
    definitions: addGeneratedDefinitions
  })
}
