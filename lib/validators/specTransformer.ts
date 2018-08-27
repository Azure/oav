// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { SchemaObject, SwaggerObject } from "yasway"
import { entries } from "@ts-common/string-map"
import { FilePosition } from "@ts-common/source-map"

/**
 * Transforms the swagger object
 */
export function transform(spec: SwaggerObject): SwaggerObject {
  if (!spec.definitions) {
    return spec
  }

  for (const [definitionName, definition] of entries(spec.definitions)) {
    insertSchemaTitle(definition, `/definitions/${definitionName}`)

    if (definition.properties) {
      for (const [propertyName, property] of entries(definition.properties)) {
        insertSchemaTitle(
          property,
          `/definitions/${definitionName}/properties/${propertyName}`
        )
      }
    }
  }

  return spec
}

export interface TitleObject {
  readonly position?: FilePosition
  readonly url?: string
  readonly title: string
}

function insertSchemaTitle(model: SchemaObject, title: string) {
  /*
  const info = getInfo(model)
  const titleObject: TitleObject = info === undefined ?
    { title } :
    {
      title,
      position: info.position,
      url: getRootObjectInfo(info).url
    }
  model.title = JSON.stringify(titleObject)
  */
 model.title = title
}
