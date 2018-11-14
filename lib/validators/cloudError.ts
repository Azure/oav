// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { SchemaObject, DefinitionsObject, ResponsesObject } from "yasway"
import { getInfoFunc, InfoFunc, cloneDeepWithInfo } from '@ts-common/source-map';

export const generatedPrefix = "generated."

const defaultPrefix = `${generatedPrefix}default.`

const cloudErrorName = `${defaultPrefix}CloudError`

/**
 * Cloud Error model.
 */
const cloudError: SchemaObject = {
  type: "object",
  title: `#/definitions/${cloudErrorName}`,
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

const cloudErrorWrapperName = `${defaultPrefix}CloudErrorWrapper`
// const cloudErrorSchemaName = `${defaultPrefix}CloudErrorSchema`

/**
 * An ARM cloud error schema.
 */
const cloudErrorSchema = {
  description: "Error response describing why the operation failed.",
  // title: `#/definitions/${cloudErrorSchemaName}`,
  schema: {
    $ref: `#/definitions/${cloudErrorWrapperName}`
  }
}

/**
 * An ARM cloud error wrapper.
 */
const cloudErrorWrapper: SchemaObject = {
  type: "object",
  title: `#/definitions/${cloudErrorWrapperName}`,
  properties: {
    error: {
      $ref: `#/definitions/${cloudErrorName}`
    }
  },
  additionalProperties: false
}

export interface ResponsesAndDefinitions {
  readonly definitions:
    (d: DefinitionsObject | undefined, defaultInfo: InfoFunc) => DefinitionsObject | undefined
  readonly responses:
    (r: ResponsesObject | undefined, defaultInfo: InfoFunc) => ResponsesObject | undefined
}

const noDefaultResponses: ResponsesAndDefinitions = {
  definitions: () => undefined,
  responses: () => undefined
}

const createImplicitDefaultResponses = (): ResponsesAndDefinitions => ({
  definitions: (d, i) => cloneDeepWithInfo(
    {
      [cloudErrorName]: cloudError,
      [cloudErrorWrapperName]: cloudErrorWrapper,
    },
    getInfoFunc(d) || i
  ),
  responses: (r, i) => cloneDeepWithInfo({ default: cloudErrorSchema }, getInfoFunc(r) || i)
})

export const getDefaultResponses = (
  implicitDefaultResponse: boolean | undefined | null
): ResponsesAndDefinitions =>
  implicitDefaultResponse ? createImplicitDefaultResponses() : noDefaultResponses
