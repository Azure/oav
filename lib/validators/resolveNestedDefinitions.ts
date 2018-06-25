// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import {
  JsonModel, JsonDefinitions, JsonSpec, JsonParameters, JsonParameter
} from "yasway"
import { updateProperty } from "../util/updateProperty"
import { objectMap } from "../util/mapObject"
import { methods } from "../util/methods"

export function resolveNestedDefinitions(spec: JsonSpec): JsonDefinitions {
  const context = new Context()
  const definitions = spec.definitions
  if (definitions) {
    for (const [name, definition] of Object.entries(definitions)) {
      context.newDefinitions[name] = context.resolveDefinition(name, definition)
    }
  }
  context.resolveParameterMap(spec, "parameters")
  context.resolveParameterMap(spec, "responses")
  const paths = spec.paths
  if (paths) {
    let i = 0
    for (const [url, path] of Object.entries(paths)) {
      const pathName = `paths_${i}`
      context.resolveParameterArray(pathName, path.parameters)
      for (const method of methods) {
        const operation = path[method]
        if (operation !== undefined) {
          context.resolveParameterArray(`operations.${operation.operationId}`, operation.parameters)
        }
      }
      ++i
    }
  }
  return context.newDefinitions
}

class Context {

  public readonly newDefinitions: JsonDefinitions = {}

  public resolveParameterMap<
    T extends { readonly [P in K]?: JsonParameters }, K extends keyof T>(
    obj: T, k: K)
    : void {
    const parameters: JsonParameters|undefined = obj[k]
    const prefix = k as string
    if (parameters) {
      for (const [name, parameter] of Object.entries(parameters)) {
        this.resolveParameter(prefix, name, parameter)
      }
    }
  }

  public resolveParameterArray(prefix: string, parameters: JsonParameter[]|undefined): void {
    if (parameters) {
      const parametersName = `${prefix}.parameters`
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

  /**
   * Resolve an OpenAPI parameter.
   * @param prefix a parameter name prefix.
   * @param name a parameter name.
   * @param parameter a parameter value.
   */
  private resolveParameter(prefix: string, name: string, parameter: JsonParameter): void {
    const schema = parameter.schema
    if (schema) {
      this.resolveNested(prefix, name, schema)
    }
  }

  private resolveNested(objectName: string, propertyName: string, model: JsonModel): JsonModel {
    // ignore references
    if (model.$ref !== undefined) {
      return model
    }

    // ignore primitive types
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
    this.newDefinitions[name] = result
    return { $ref: `#/definitions/${name}` }
  }
}
