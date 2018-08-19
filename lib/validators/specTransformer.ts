// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { SchemaObject, SwaggerObject } from "yasway"
import { entries } from "@ts-common/string-map"
import { FilePosition, getInfo, Info, FileInfo } from "@ts-common/source-map"

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
  position?: FilePosition
  url?: string
  readonly title: string
}

const getFileInfo = (info: Info): FileInfo =>
  info.kind === "file" ? info : getFileInfo(info.parent)

function insertSchemaTitle(model: SchemaObject, title: string) {
  const info = getInfo(model)
  const titleObject: TitleObject = {
    title
  }
  if (info !== undefined) {
    if (info.kind === "object") {
      titleObject.position = {
        line: info.position.line + 1,
        column: info.position.column + 1,
      }
    }
    titleObject.url = getFileInfo(info).url
  }
  model.title = JSON.stringify(titleObject)
}
