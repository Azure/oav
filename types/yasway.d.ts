// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

declare module "yasway" {

  /**
   * JSON Schema "properties"
   */
  interface JsonSchemaProperties {
    [name: string]: SchemaObject
  }

  interface ParameterObject {
    name: string
    in: string
    schema?: SchemaObject
    required?: boolean
    items?: SchemaObject
    type?: DataType
  }

  type DataType = "integer"|"number"|"string"|"boolean"|"null"|"file"|"object"|"array"

  interface SchemaObject {
    type?: DataType
    items?: SchemaObject
    properties?: JsonSchemaProperties
    additionalProperties?: SchemaObject|boolean
    "x-nullable"?: boolean
    in?: string
    oneOf?: SchemaObject[]
    $ref?: string
    required?: string[]|false
    schema?: SchemaObject
    allOf?: SchemaObject[]
    description?: string
    discriminator?: string
    "x-ms-discriminator-value"?: string
    enum?: string[]
    "x-ms-azure-resource"?: boolean
    anyOf?: SchemaObject[]
  }

  interface ResponsesObject {
    default?: ResponseObject
    [name: string]: ResponseObject|undefined
  }

  interface OperationObject {
    operationId?: string
    parameters?: ParameterObject[]
    consumes?: string[]
    produces?: string[]
    responses?: ResponsesObject
  }

  type Methods = "get"|"put"|"post"|"delete"|"options"|"head"|"patch"

  type PathItemObjectMethods = {
    [m in Methods]?: OperationObject
  }

  interface PathItemObject extends PathItemObjectMethods {
    parameters?: ParameterObject[]
  }

  interface PathsObject {
    [name: string]: PathItemObject
  }

  interface DefinitionsObject {
    [name: string]: SchemaObject
  }

  interface ParametersDefinitionsObject {
    [name: string]: ParameterObject
  }

  interface ResponseObject {
    schema?: SchemaObject
  }

  interface ResponsesDefinitionsObject {
    [name: string]: ResponseObject
  }

  interface SwaggerObject {
    "x-ms-paths"?: PathsObject
    paths?: PathsObject
    definitions?: DefinitionsObject
    "x-ms-parameterized-host"?: {
      parameters: ParameterObject[]
    }
    consumes?: string[]
    produces?: string[]
    parameters?: ParametersDefinitionsObject
    responses?: ResponsesDefinitionsObject
    readonly documents?: any
  }

  interface Options {
    readonly definition: SwaggerObject
    readonly jsonRefs: {
      readonly relativeBase: any
    }
    readonly isPathCaseSensitive?: boolean
  }

  interface Validation {
    readonly errors: any[]
    readonly warnings?: any[]
  }

  interface ParsedUrlQuery {
    [key: string]: any
  }
  interface LiveRequest {
    query?: ParsedUrlQuery
    readonly url: string
    readonly method: string
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
    validateRequest(_: LiveRequest): Validation
    validateResponse(_: any): Validation
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
