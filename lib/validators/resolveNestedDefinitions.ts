// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { JsonModel, JsonDefinitions } from "sway"
import { updateProperty } from "../util/updateProperty"
import { objectMap } from "../util/mapObject"

export function resolveNestedDefinitions(definitions: JsonDefinitions|undefined): JsonDefinitions {
  const result = new Result()
  if (definitions) {
    for (const name in definitions) {
      const definition = definitions[name]
      result.extra[name] = definition
      result.resolveDefinition(name, definition)
    }
  }
  // TODO: scan parameters and response
  return result.extra
}

class Result {

  public readonly extra: JsonDefinitions = {}

  public resolveDefinition(name: string, definition: JsonModel): JsonModel {

    updateProperty(definition,
      "properties",
      (ps, n) => ps === undefined
        ? undefined
        : objectMap(ps, (p, pn) => this.resolveNested(name, `${n}.${pn}`, p)))

    updateProperty(
      definition,
      "additionalProperties",
      (ap, n) => ap !== undefined && typeof ap === "object"
        ? this.resolveNested(name, n, ap)
        : ap)

    updateProperty(
      definition,
      "items",
      (v, n) => v !== undefined ? this.resolveNested(name, n, v) : undefined)

    const resolveNestedArrayProperty = (v: JsonModel[]|undefined, n: string) =>
      v !== undefined
        ? v.map((x, i) => this.resolveNested(name, `${n}[${i}]`, x))
        : undefined

    updateProperty(definition, "oneOf", resolveNestedArrayProperty)
    updateProperty(definition, "allOf", resolveNestedArrayProperty)
    updateProperty(definition, "anyOf", resolveNestedArrayProperty)

    return definition
  }

  private resolveNested(objectName: string, propertyName: string, model: JsonModel): JsonModel {
    if (model.$ref !== undefined) {
      return model
    }

    switch (model.type) {
      case "integer":
      case "number":
      case "string":
      case "boolean":
      case "file":
        return model
    }

    const name = `${objectName}.${propertyName}`
    const result = this.resolveDefinition(name, model)
    // return result
    this.extra[name] = result
    return { $ref: `/definitions/${name}` }
  }
}
