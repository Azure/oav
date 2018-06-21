// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import {
  JsonModel, JsonDefinitions, JsonSpec, JsonParameters, JsonOperation, JsonParameter
} from "yasway"
import { updateProperty } from "../util/updateProperty"
import { objectMap } from "../util/mapObject"
import { methods } from "../util/methods"

export function resolveNestedDefinitions(spec: JsonSpec): JsonDefinitions {
  const result = new Result()
  const definitions = spec.definitions
  if (definitions) {
    for (const name in definitions) {
      const definition = definitions[name]
      result.extra[name] = definition
      result.resolveDefinition(name, definition)
    }
  }
  result.resolveParameterMap(spec, "parameters")
  result.resolveParameterMap(spec, "responses")
  const paths = spec.paths
  if (paths) {
    let i = 0
    for (const url in paths) {
      const path = paths[url]
      const pathName = `paths_${i}`
      result.resolveParameterArray(pathName, path.parameters)
      for (const method of methods) {
        const operation = path[method]
        if (operation !== undefined) {
          result.resolveParameterArray(`operations.${operation.operationId}`, operation.parameters)
        }
      }
      ++i
    }
  }
  return result.extra
}

class Result {

  public readonly extra: JsonDefinitions = {}

  public resolveParameterMap<
    T extends { readonly [P in K]?: JsonParameters }, K extends keyof T>(
    obj: T, k: K)
    : void {
    const parameters = obj[k]
    const name = k as string
    if (parameters) {
      for (const pn in parameters) {
        this.resolveParameter(name, pn, parameters[pn])
      }
    }
  }

  public resolveParameterArray(path: string, parameters: JsonParameter[]|undefined): void {
    if (parameters) {
      const parametersName = `${path}.parameters`
      for (const parameter of parameters) {
        this.resolveParameter(parametersName, parameter.name, parameter)
      }
    }
  }

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
        ? v.map((x, i) => this.resolveNested(name, `${n}_${i}`, x))
        : undefined

    updateProperty(definition, "oneOf", resolveNestedArrayProperty)
    updateProperty(definition, "allOf", resolveNestedArrayProperty)
    updateProperty(definition, "anyOf", resolveNestedArrayProperty)

    return definition
  }

  private resolveParameter(path: string, name: string, parameter: JsonParameter): void {
    const schema = parameter.schema
    if (schema) {
      this.resolveNested(path, name, schema)
    }
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
      case "null":
      case "file":
        return model
    }

    const name = `${objectName}.${propertyName}`
    const result = this.resolveDefinition(name, model)
    this.extra[name] = result
    return { $ref: `#/definitions/${name}` }
  }
}
