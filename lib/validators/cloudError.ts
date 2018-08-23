// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { SchemaObject, DefinitionsObject, ResponsesObject } from "yasway"

export const generatedPrefix = "generated."

export const generatedCloudErrorName = generatedPrefix + "CloudError"

/**
 * Models a Cloud Error
 */
export const generatedCloudError: SchemaObject = {
  type: "object",
  title: "#/definitions/" + generatedCloudErrorName,
  properties: {
    code: {
      type: "string",
      description:
        "An identifier for the error. Codes are invariant and are intended to be consumed " +
        "programmatically."
    },
    message: {
      type: "string",
      description:
        "A message describing the error, intended to be suitable for display in a user interface."
    },
    target: {
      type: "string",
      description:
        "The target of the particular error. For example, the name of the property in error."
    },
    details: {
      type: "array",
      items: { type: "object" },
      description: "A list of additional details about the error."
    },
    additionalInfo: {
      type: "array",
      items: { type: "object" },
      description: "A list of additional info about an error."
    },
    innererror: {
      type: "object"
    }
  },
  required: ["code", "message"],
  additionalProperties: false
}

export const generatedCloudErrorWrapperName = generatedPrefix + "CloudErrorWrapper"
export const generatedCloudErrorSchemaName = generatedPrefix + "CloudErrorSchema"

/**
 * Models an ARM cloud error schema.
 */
export const generatedCloudErrorSchema = {
  description: "Error response describing why the operation failed.",
  title: "#/definitions/" + generatedCloudErrorSchemaName,
  schema: {
    $ref: "#/definitions/" + generatedCloudErrorWrapperName
  }
}

/**
 * Models an ARM cloud error wrapper.
 */
export const generatedCloudErrorWrapper: SchemaObject = {
  type: "object",
  title: "#/definitions/" + generatedCloudErrorWrapperName,
  properties: {
    error: {
      $ref: "#/definitions/" + generatedCloudErrorName
    }
  },
  additionalProperties: false
}

export interface ResponsesAndDefinitions {
  readonly definitions: DefinitionsObject
  readonly responses: ResponsesObject
}

const noDefaultResponses: ResponsesAndDefinitions = {
  definitions: {},
  responses: {}
}

const implicitDefaultResponses: ResponsesAndDefinitions = {
  definitions: {
    [generatedCloudErrorName]: generatedCloudError,
    [generatedCloudErrorWrapperName]: generatedCloudErrorWrapper
  },
  responses: {
    default: generatedCloudErrorSchema
  }
}

export const getDefaultResponses = (
  implicitDefaultResponse: boolean | undefined | null
): ResponsesAndDefinitions =>
  implicitDefaultResponse ? implicitDefaultResponses : noDefaultResponses
