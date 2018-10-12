// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { SchemaObject, SwaggerObject } from "yasway"
import { StringMap, values } from "@ts-common/string-map"
import {
  FilePosition, getRootObjectInfo, getAllDirectives, getPath, InfoFunc, getInfoFunc, setInfoFunc
} from "@ts-common/source-map"

export interface TitleObject {
  readonly position?: FilePosition
  readonly directives?: StringMap<unknown>
  readonly url?: string
  readonly path?: ReadonlyArray<string | number>
}

export interface SchemaObjectInfo {
  readonly title: string
  readonly infoFunc: InfoFunc
}

export const getSchemaObjectInfo = (model: SchemaObject): SchemaObjectInfo | undefined => {
  const infoFunc = getInfoFunc(model)
  if (infoFunc === undefined) {
    return undefined
  }
  const info = infoFunc()
  return {
    title: JSON.stringify(
      {
        path: getPath(info),
        position: info.position,
        url: getRootObjectInfo(info).url,
        directives: getAllDirectives(model, []),
      }
    ),
    infoFunc
  }
}

export const setSchemaInfo = (
  model: SchemaObject,
  info: SchemaObjectInfo | undefined,
): SchemaObject => {
  if (info !== undefined) {
    model.title = info.title
    setInfoFunc(model, info.infoFunc)
  }
  return model
}

export const setSchemaTitle = (model: SchemaObject) =>
  setSchemaInfo(model, getSchemaObjectInfo(model))
