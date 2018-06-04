// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

declare module "sway" {
  interface Options {
    definition: any
    jsonRefs: { relativeBase: any }
    isPathCaseSensitive?: boolean
  }
  interface SwaggerApi {
    validate(): any
    getOperations(): any[]
    info: {
      version: string
      title: any
    }
  }
  function create(options: Options): Promise<SwaggerApi>
}