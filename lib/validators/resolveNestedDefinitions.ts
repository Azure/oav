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
import { PropertySetTransformation, propertySetMap } from "../util/propertySet"
import { stringMapMap, stringMapForEach } from "../util/stringMap"
import { objectPathLast } from "../util/objectPath"
import { arrayMap } from "../util/array"
import { Tracked, tracked } from "../util/tracked";
import * as uuid from "uuid"

export function resolveNestedDefinitions(spec: SwaggerObject): SwaggerObject {

  const newDefinitions: DefinitionsObject = {}

  // a function to resolve nested schema objects
  function resolveNestedSchemaObject(schemaObjectTracked: Tracked<SchemaObject>) {
    // ignore references
    const schemaObject = schemaObjectTracked.value
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

    // schemaObject.type is one of {undefined, "object", "array"}.
    // Because it's a nested schema object, we create a new definition and return a reference.
    const result = resolveSchemaObject(schemaObjectTracked)
    const definitionName = uuid.v4()
    newDefinitions[definitionName] = result
    return { $ref: `#/definitions/${encodeURIComponent(definitionName)}` }
  }

  // a function to resolve SchemaObject array
  function resolveSchemaObjectArray(schemaObjectArrayTracked: Tracked<SchemaObject[]>) {
    return arrayMap(schemaObjectArrayTracked, resolveNestedSchemaObject)
  }

  // a function to resolve SchemaObject (top-level and nested)
  function resolveSchemaObject(schemaObjectTracked: Tracked<SchemaObject>) {
    return propertySetMap<SchemaObject>(
      schemaObjectTracked,
      {
        properties: propertiesTracked => stringMapMap(propertiesTracked, resolveNestedSchemaObject),
        additionalProperties: additionalPropertiesTracked => {
          const additionalProperties = additionalPropertiesTracked.value
          return typeof additionalProperties === "object"
            ? resolveNestedSchemaObject(
              tracked(additionalProperties, additionalPropertiesTracked.path))
            : additionalProperties
        },
        items: resolveNestedSchemaObject,
        allOf: resolveSchemaObjectArray,
        anyOf: resolveSchemaObjectArray,
        oneOf: resolveSchemaObjectArray,
      })
  }

  function resolveParameterObject(parameterObjectTracked: Tracked<ParameterObject>) {
    return propertySetMap(parameterObjectTracked, { schema: resolveSchemaObject })
  }

  function resolveResponseObject(responseObjectTracked: Tracked<ResponseObject>) {
    return propertySetMap(responseObjectTracked, { schema: resolveSchemaObject })
  }

  function resolveParameterArray(parametersTracked: Tracked<ParameterObject[]>) {
     return arrayMap(parametersTracked, resolveParameterObject)
  }

  function resolveOperationObject(operationObjectTracked: Tracked<OperationObject>) {
    return propertySetMap<OperationObject>(
      operationObjectTracked,
      {
        parameters: resolveParameterArray,
        responses: responsesTracked => stringMapMap(responsesTracked, resolveResponseObject)
      })
  }

  // transformations for Open API 2.0
  const swaggerObjectTransformation: PropertySetTransformation<SwaggerObject> = {
    definitions: definitionsTracked => {
      stringMapForEach(
        definitionsTracked,
        definitionTracked => {
          // add resolved definitions into the `newDefinitions` map
          newDefinitions[objectPathLast(definitionTracked.path)] =
            resolveSchemaObject(definitionTracked)
        })
      return newDefinitions
    },
    parameters: parametersTracked => stringMapMap(parametersTracked, resolveParameterObject),
    responses: responsesTracked => stringMapMap(responsesTracked, resolveResponseObject),
    paths: pathsTracked => stringMapMap(
      pathsTracked,
      pathTracked => propertySetMap<PathItemObject>(
        pathTracked,
        {
          get: resolveOperationObject,
          put: resolveOperationObject,
          post: resolveOperationObject,
          delete: resolveOperationObject,
          options: resolveOperationObject,
          head: resolveOperationObject,
          patch: resolveOperationObject,
          parameters: resolveParameterArray
        }))
  }

  // resolve the given OpenAPI document.
  return propertySetMap(tracked(spec, []), swaggerObjectTransformation)
}
