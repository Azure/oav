// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

declare module "yasway" {
  interface Options {
    readonly definition: any
    readonly jsonRefs: {
      readonly relativeBase: any
    }
    readonly isPathCaseSensitive?: boolean
  }
  interface RequestValidation {
    readonly errors: any
  }
  interface ResponseValidation {
    readonly errors: any
  }
  interface PathObject {
    path: string
    readonly regexp: RegExp
    api: {
      "x-ms-parameterized-host": any
      host: any
      schemes: string[]
      basePath: any
    }
  }
  interface Responses {
    readonly default: {
      readonly schema: {
        readonly properties: {
          readonly [property: string]: {}
        }
      }
    }
  }
  interface Parameter {
    schema: any
    name: any
    format: any
    required: any
    in: any
    "x-ms-skip-url-encoding": any
    type: any
    getSample(): any
  }
  interface Response {
    readonly statusCode: any
    readonly schema: any
    readonly examples: any
  }
  interface Operation {
    readonly operationId?: any
    readonly method?: any
    readonly pathObject?: PathObject
    provider?: any
    readonly responses?: Responses
    "x-ms-examples": any
    readonly consumes: string[]
    readonly produces: any
    validateRequest(_: any): RequestValidation
    validateResponse(_: any): ResponseValidation
    getParameters(): Parameter[]
    getResponses(): Response[]
    getResponse(_: string): Response
  }
  interface SwaggerApi {
    readonly info: {
      readonly version: string
      readonly title: any
    }
    validate(): any
    getOperations(): Operation[]
  }
  function create(options: Options): Promise<SwaggerApi>
}
