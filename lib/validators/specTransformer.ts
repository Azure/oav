// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { SchemaObject, SwaggerObject } from "yasway"
import { entries } from "@ts-common/string-map"

/**
 * Transforms the swagger object
 */
export function transform(spec: SwaggerObject): SwaggerObject {
  if (!spec.definitions) {
    return spec
  }

  for (const [definitionName, definition] of entries(spec.definitions)) {
    insertSchemaTitle(definition, `#/definitions/${definitionName}`)

    if (definition.properties) {
      for (const [propertyName, property] of entries(definition.properties)) {
        insertSchemaTitle(
          property,
          `#/definitions/${definitionName}/properties/${propertyName}`
        )
      }
    }
  }

  return spec
}

function insertSchemaTitle(model: SchemaObject, title: string) {
  model.title = title
}
