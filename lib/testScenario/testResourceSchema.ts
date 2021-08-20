import { Schema } from "../swagger/swaggerTypes";

export const TestDefinition: Schema & {
  definitions: { [def: string]: Schema };
} = {
  type: "object",
  properties: {
    variables: {
      $ref: "#/definitions/Variables",
    },
    scope: {
      type: "string",
      enum: ["ResourceGroup"],
    },
    requiredVariables: {
      type: "array",
      description: "Variables required at runtime",
      items: {
        $ref: "#/definitions/Name",
      },
    },
    prepareSteps: {
      $ref: "#/definitions/TestStepList",
      description: "Prepare steps before executing scenarios",
    },
    testScenarios: {
      type: "array",
      description: "Test scenarios",
      items: {
        propertyNames: {
          $ref: "#/definitions/Name",
        },
        additionalProperties: {
          $ref: "#/definitions/TestScenario",
        },
        minProperties: 1,
        maxProperties: 1,
      },
      minItems: 1,
    },
    cleanUpSteps: {
      $ref: "#/definitions/TestStepList",
      description: "Clean up steps after executing scenarios",
    },
  },
  required: ["testScenarios"],
  additionalProperties: false,
  definitions: {
    Name: {
      type: "string",
      pattern: "^[A-Za-z_][A-Za-z0-9_-]*$",
    },
    JsonPointer: {
      type: "string",
      description: "JSON Pointer described by RFC 6901, e.g. /foo/bar",
      pattern: "^(/(([^/~])|(~[01]))*)*$",
    },
    Variables: {
      type: "object",
      propertyNames: {
        $ref: "#/definitions/Name",
      },
      additionalProperties: {
        oneOf: [
          {
            type: "string",
          },
          {
            type: "object",
            properties: {
              secret: {
                type: "boolean",
                default: false,
              },
              defaultValue: {
                type: "string",
              },
            },
            additionalProperties: false,
          },
        ],
      },
    },
    TestScenario: {
      type: "object",
      properties: {
        variables: {
          $ref: "#/definitions/Variables",
        },
        shareScope: {
          type: "boolean",
          description: "Whether to share the scope and prepareSteps with other scenarios",
          default: true,
        },
        description: {
          type: "string",
          description: "A long description of the scenario",
        },
        steps: {
          $ref: "#/definitions/TestStepList",
        },
      },
      required: ["steps"],
      additionalProperties: false,
    },
    TestStepList: {
      type: "array",
      items: {
        description: "Pair of name and step",
        propertyNames: {
          $ref: "#/definitions/Name",
        },
        additionalProperties: {
          $ref: "#/definitions/TestStep",
        },
        minProperties: 1,
        maxProperties: 1,
      },
    },
    TestStep: {
      oneOf: [
        {
          $ref: "#/definitions/TestStepRestCall",
        },
        {
          $ref: "#/definitions/TestStepRestOperation",
        },
        {
          $ref: "#/definitions/TestStepArmTemplateDeployment",
        },
        {
          $ref: "#/definitions/TestStepRawCall",
        },
      ],
    },
    TestStepBase: {
      properties: {
        variables: {
          $ref: "#/definitions/Variables",
        },
        description: {
          type: "string",
          description: "A long description of the step",
        },
        outputVariables: {
          type: "object",
          propertyNames: {
            $ref: "#/definitions/Name",
          },
          additionalProperties: {
            type: "object",
            properties: {
              fromResponse: {
                type: "string",
              },
            },
          },
        },
      },
    },
    TestStepRestBase: {
      allOf: [
        {
          $ref: "#/definitions/TestStepBase",
        },
      ],
      properties: {
        resourceUpdate: {
          type: "array",
          description: "Update resource properties in body for both request and expected response",
          items: {
            $ref: "#/definitions/JsonPatchOp",
          },
          minItems: 1,
        },
        requestUpdate: {
          type: "array",
          description: "Update request parameters",
          items: {
            $ref: "#/definitions/JsonPatchOp",
          },
          minItems: 1,
        },
        responseUpdate: {
          type: "array",
          description: "Update expected response",
          items: {
            $ref: "#/definitions/JsonPatchOp",
          },
          minItems: 1,
        },
        statusCode: {
          type: "integer",
          description: "Expected response code",
          default: 200,
        },
      },
    },
    TestStepRestCall: {
      type: "object",
      allOf: [
        {
          $ref: "#/definitions/TestStepRestBase",
        },
      ],
      properties: {
        exampleFile: {
          type: "string",
        },
        resourceName: {
          $ref: "#/definitions/Name",
          description: "Name a resource for tracking",
        },
      },
      required: ["exampleFile"],
    },
    TestStepRestOperation: {
      type: "object",
      allOf: [
        {
          $ref: "#/definitions/TestStepRestBase",
        },
      ],
      properties: {
        operationId: {
          type: "string",
          description: "The operationId to perform on a tracking resource",
        },
        resourceName: {
          $ref: "#/definitions/Name",
          description: "Reference a tracking resource",
        },
      },
      required: ["operationId", "resourceName"],
    },
    TestStepArmTemplateDeployment: {
      type: "object",
      allOf: [
        {
          $ref: "#/definitions/TestStepBase",
        },
      ],
      properties: {
        armTemplateDeployment: {
          type: "string",
        },
        armTemplateParameters: {
          type: "string",
        },
      },
      required: ["armTemplateDeployment"],
    },
    TestStepRawCall: {
      type: "object",
      allOf: [
        {
          $ref: "#/definitions/TestStepBase",
        },
      ],
      properties: {
        method: {
          type: "string",
          enum: ["GET", "PUT", "PATCH", "POST", "DELETE", "OPTIONS", "HEAD"],
        },
        url: {
          type: "string",
        },
        requestHeaders: {
          type: "object",
          additionalProperties: {
            type: "string",
          },
        },
        requestBody: {},
        statusCode: {
          type: "integer",
          description: "Expected response code",
          default: 200,
        },
        responseExpected: {},
      },
      required: ["method", "url", "requestHeaders", "requestBody"],
    },
    JsonPatchOp: {
      type: "object",
      description: "Change a JSON document in a format described by RFC 6902",
      oneOf: [
        {
          $ref: "#/definitions/JsonPatchOpAdd",
        },
        {
          $ref: "#/definitions/JsonPatchOpRemove",
        },
        {
          $ref: "#/definitions/JsonPatchOpReplace",
        },
        {
          $ref: "#/definitions/JsonPatchOpCopy",
        },
        {
          $ref: "#/definitions/JsonPatchOpMove",
        },
        {
          $ref: "#/definitions/JsonPatchOpTest",
        },
      ],
    },
    JsonPatchOpAdd: {
      type: "object",
      required: ["add", "value"],
      properties: {
        add: {
          $ref: "#/definitions/JsonPointer",
        },
        value: {},
      },
      additionalProperties: false,
    },
    JsonPatchOpRemove: {
      type: "object",
      required: ["remove"],
      properties: {
        remove: {
          $ref: "#/definitions/JsonPointer",
        },
      },
      additionalProperties: false,
    },
    JsonPatchOpReplace: {
      type: "object",
      required: ["replace", "value"],
      properties: {
        replace: {
          $ref: "#/definitions/JsonPointer",
        },
        value: {},
      },
      additionalProperties: false,
    },
    JsonPatchOpCopy: {
      type: "object",
      required: ["copy", "from"],
      properties: {
        copy: {
          $ref: "#/definitions/JsonPointer",
        },
        from: {
          $ref: "#/definitions/JsonPointer",
        },
      },
      additionalProperties: false,
    },
    JsonPatchOpMove: {
      type: "object",
      required: ["move", "from"],
      properties: {
        move: {
          $ref: "#/definitions/JsonPointer",
        },
        from: {
          $ref: "#/definitions/JsonPointer",
        },
      },
      additionalProperties: false,
    },
    JsonPatchOpTest: {
      type: "object",
      required: ["test", "value"],
      properties: {
        test: {
          $ref: "#/definitions/JsonPointer",
        },
        value: {},
      },
      additionalProperties: false,
    },
  },
};
