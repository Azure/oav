// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.
import { SchemaObject } from "yasway"
import { StringMap } from "@ts-common/string-map"
import {
  FilePosition, getRootObjectInfo, getAllDirectives, getPath, InfoFunc, getInfoFunc, setInfoFunc
} from "@ts-common/source-map"
import * as json from '@ts-common/json';

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

export const getTitle = (model: json.JsonObject|json.JsonArray): TitleObject|undefined => {
  const infoFunc = getInfoFunc(model)
  if (infoFunc === undefined) {
    return undefined
  }
  const info = infoFunc()
  return {
    path: getPath(info),
    position: info.position,
    url: getRootObjectInfo(info).url,
    directives: getAllDirectives(model, []),
  }
}

export const getSchemaObjectInfo = (
  model: json.JsonObject|json.JsonArray
): SchemaObjectInfo | undefined => {
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
    // add source map info function to the `model`.
    setInfoFunc(model, info.infoFunc)
  }
  return model
}

export const setSchemaTitle = (model: SchemaObject) =>
  setSchemaInfo(model, getSchemaObjectInfo(model))
