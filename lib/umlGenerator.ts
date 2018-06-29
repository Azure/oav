// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import yuml2svg = require("yuml2svg")
import * as utils from "./util/utils"
import { log } from "./util/logging"
import { Unknown } from "./util/unknown"
import { SwaggerObject, DefinitionsObject, SchemaObject } from "yasway"

export interface Options {
  readonly direction?: Unknown
  readonly shouldDisableAllof?: Unknown
  readonly shouldDisableProperties?: Unknown
  readonly shouldDisableRefs?: Unknown
}

/**
 * @class
 * Generates a Uml Diagaram in svg format.
 */
export class UmlGenerator {

  private readonly specInJson: SwaggerObject

  private graphDefinition: string

  private readonly options: Options

  private readonly bg = "{bg:cornsilk}"

  /**
   * @constructor
   * Initializes a new instance of the UmlGenerator class.
   *
   * @param {object} specInJson the parsed spec in json format
   *
   * @return {object} An instance of the UmlGenerator class.
   */
  constructor(specInJson: null|undefined|SwaggerObject, options: null|undefined|Options) {
    if (specInJson === null || specInJson === undefined || typeof specInJson !== "object") {
      throw new Error("specInJson is a required property of type object")
    }
    this.specInJson = specInJson
    this.graphDefinition = ""
    this.options = !options ? {} : options
  }

  public async generateDiagramFromGraph(): Promise<string> {
    this.generateGraphDefinition()
    let svg = ""

    log.info(this.graphDefinition)
    svg = yuml2svg(this.graphDefinition, false, { dir: this.options.direction, type: "class" })
    // console.log(svg)
    return svg
  }

  private generateGraphDefinition(): void {
    this.generateModelPropertiesGraph()
    if (!this.options.shouldDisableAllof) {
      this.generateAllOfGraph()
    }
  }

  private generateAllOfGraph(): void {
    const spec = this.specInJson
    const definitions = spec.definitions as DefinitionsObject
    for (const modelName of utils.getKeys(definitions)) {
      const model = definitions[modelName]
      this.generateAllOfForModel(modelName, model)
    }
  }

  private generateAllOfForModel(modelName: Unknown, model: SchemaObject): void {
    if (model.allOf) {
      model.allOf.forEach(item => {
        const ref = item.$ref
        if (ref === undefined) {
          throw new Error("ref === undefined")
        }
        const segments = ref.split("/")
        const parent = segments[segments.length - 1]
        this.graphDefinition += `\n[${parent}${this.bg}]^-.-allOf[${modelName}${this.bg}]`
      })
    }
  }

  private generateModelPropertiesGraph(): void {
    const spec = this.specInJson
    const definitions = spec.definitions as DefinitionsObject
    const references: string[] = []
    for (const modelName of utils.getKeys(definitions)) {
      const model = definitions[modelName]
      const modelProperties = model.properties
      let props = ""
      if (modelProperties) {
        for (const propertyName of utils.getKeys(modelProperties)) {
          const property = modelProperties[propertyName]
          const propertyType = this.getPropertyType(modelName, property, references)
          let discriminator = ""
          if (model.discriminator && model.discriminator === propertyName) {
            discriminator = "(discriminator)"
          }
          props += `-${propertyName}${discriminator}:${propertyType};`
        }
      }
      if (!this.options.shouldDisableProperties) {
        this.graphDefinition += props.length
          ? `[${modelName}|${props}${this.bg}]\n`
          : `[${modelName}${this.bg}]\n`
      }
    }
    if (references.length && !this.options.shouldDisableRefs) {
      this.graphDefinition += references.join("\n")
    }
  }

  private getPropertyType(
    modelName: Unknown, property: SchemaObject, references: string[]
  ): string {

    const type = property.type
    switch (type) {
      case "string":
      case "number":
      case "boolean":
        return type
    }

    if (type === "array") {
      let result = "Array<"
      if (property.items) {
        result += this.getPropertyType(modelName, property.items, references)
      }
      result += ">"
      return result
    }

    if (property.$ref) {
      const segments = property.$ref.split("/")
      const referencedModel = segments[segments.length - 1]
      references.push(`[${modelName}${this.bg}]->[${referencedModel}${this.bg}]`)
      return referencedModel
    }

    if (property.additionalProperties && typeof property.additionalProperties === "object") {
      let result = "Dictionary<"
      result += this.getPropertyType(modelName, property.additionalProperties, references)
      result += ">"
      return result
    }

    if (type === "object") {
      return "Object"
    }
    return ""
  }
}
