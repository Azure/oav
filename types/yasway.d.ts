// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

declare module "yasway" {

  export interface JsonRef {
    readonly $ref: string
  }

  interface JsonProperties {
    [name: string]: JsonModel
  }

  interface JsonParameter {
    name: string
    in: string
    schema?: JsonModel
    required?: boolean
    items?: JsonModel
    type?: any
  }

  interface JsonModel {
    type?: "integer"|"number"|"string"|"boolean"|"null"|"file"|"object"|"array"
    items?: JsonModel
    properties?: JsonProperties
    additionalProperties?: JsonModel|boolean
    "x-nullable"?: any
    in?: any
    oneOf?: JsonModel[]
    $ref?: string
    required?: any[]|false
    schema?: JsonModel
    allOf?: JsonModel[]
    description?: any
    discriminator?: string
    "x-ms-discriminator-value"?: string
    enum?: any
    "x-ms-azure-resource"?: any
    anyOf?: JsonModel[]
  }

  interface JsonOperation {
    operationId?: string
    parameters?: JsonParameter[]
    consumes?: string[]
    produces?: string[]
    responses?: {
      [name: string]: JsonModel
    }
  }

  type Methods = "get"|"put"|"post"|"delete"|"options"|"head"|"patch"

  type JsonPathMethods = {
    [m in Methods]?: JsonOperation
  }

  interface JsonPath extends JsonPathMethods {
    parameters?: JsonParameter[]
  }

  interface JsonPaths {
    [name: string]: JsonPath
  }

  interface JsonDefinitions {
    [name: string]: JsonModel
  }

  interface JsonParameters {
    [name: string]: JsonParameter
  }

  interface JsonSpec {
    "x-ms-paths"?: JsonPaths
    paths?: JsonPaths
    definitions?: JsonDefinitions
    "x-ms-parameterized-host"?: {
      parameters: any
    }
    consumes?: string[]
    produces?: string[]
    parameters?: JsonParameters
    responses?: JsonParameters
    readonly documents?: any
  }

  interface Options {
    readonly definition: JsonSpec
    readonly jsonRefs: {
      readonly relativeBase: any
    }
    readonly isPathCaseSensitive?: boolean
  }

  interface RequestValidation {
    readonly errors: any[]
  }
  interface ParsedUrlQuery {
    [key: string]: any
  }
  interface LiveRequest {
    query?: ParsedUrlQuery
    readonly url: string
    readonly method: string
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
    validateRequest(_: LiveRequest): RequestValidation
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
