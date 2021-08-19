import { Schema } from "../swagger/swaggerTypes";

const String: Schema = {
  type: "string",
};

const StatusCode: Schema = {
  type: "integer",
  default: 200,
};

const Name: Schema = {
  type: "string",
  pattern: "^[a-zA-Z0-9_-]+$",
};

const JsonPointer: Schema = {
  type: "string",
  description: "String syntax for identifying a specific value within JSON document",
  pattern: "^(/(([^/~])|(~[01]))*)*$",
};

const VariableScope: Schema = {
  type: "object",
  properties: {
    variables: {
      type: "object",
      propertyNames: {
        $ref: "#/definitions/Name",
      },
      additionalProperties: String,
    },
  },
};

const TestStepBase: Schema = {
  allOf: [{ $ref: "#/definitions/VariableScope" }],
  properties: {
    step: {
      $ref: "#/definitions/Name",
    },
    description: String,
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
  required: ["step"],
};

const TestStepRestBase: Schema = {
  allOf: [{ $ref: "#/definitions/TestSTepBase" }],
  properties: {
    resourceUpdate: {
      type: "array",
      items: {
        $ref: "#/definitions/JsonPatchOp",
      },
      minItems: 1,
    },
    requestUpdate: {
      type: "array",
      items: {
        $ref: "#/definitions/JsonPatchOp",
      },
      minItems: 1,
    },
    responseUpdate: {
      type: "array",
      items: {
        $ref: "#/definitions/JsonPatchOp",
      },
      minItems: 1,
    },
    statusCode: StatusCode,
  },
};

const TestStep: Schema = {
  oneOf: [
    {
      $ref: "#/definitions/TestStepRestCall",
    },
    {
      $ref: "#/definitions/TestStepOperation",
    },
    {
      $ref: "#/definitions/TestStepArmTemplateDeployment",
    },
    {
      $ref: "#/definitions/TestStepRawCall",
    },
  ],
};

const TestStepRestCall: Schema = {
  type: "object",
  allOf: [{ $ref: "#/definitions/TestStepRestBase" }],
  properties: {
    exampleFile: String,
    resourceName: {
      $ref: "#/definitions/Name",
    },
  },
  required: ["exampleFile"],
};

const TestStepRestOperation: Schema = {
  type: "object",
  allOf: [{ $ref: "#/definitions/TestStepRestBase" }],
  properties: {
    operationId: {
      $ref: "#/definitions/Name",
    },
    resourceName: {
      $ref: "#/definitions/Name",
    },
  },
  required: ["resourceName", "operationId"],
};

const TestStepArmTemplateDeployment: Schema = {
  type: "object",
  allOf: [{ $ref: "#/definitions/TestStepBase" }],
  properties: {
    armTemplateDeployment: String,
    armTemplateParameters: String,
  },
  required: ["armTemplateDeployment"],
};

const TestStepRawCall: Schema = {
  type: "object",
  allOf: [{ $ref: "#/definitions/TestStepBase" }],
  properties: {
    method: {
      type: "string",
      enum: ["GET", "PUT", "PATCH", "POST", "DELETE", "OPTIONS", "HEAD"],
    },
    url: String,
    requestHeaders: {
      type: "object",
      additionalProperties: {
        type: "string",
      },
    },
    requestBody: {},
    statusCode: StatusCode,
    responseExpected: {},
  },
  required: ["method", "url", "requestHeaders", "requestBody"],
};

const JsonPatchOpSchemas: { [key: string]: Schema } = {
  JsonPatchOp: {
    type: "object",
    oneOf: [
      { $ref: "#/definitions/JsonPatchOpAdd" },
      { $ref: "#/definitions/JsonPatchOpRemove" },
      { $ref: "#/definitions/JsonPatchOpReplace" },
      { $ref: "#/definitions/JsonPatchOpCopy" },
      { $ref: "#/definitions/JsonPatchOpMove" },
      { $ref: "#/definitions/JsonPatchOpTest" },
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
  },
  JsonPatchOpRemove: {
    type: "object",
    required: ["remove"],
    properties: {
      remove: {
        $ref: "#/definitions/JsonPointer",
      },
    },
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
  },
};

const TestScenario: Schema = {
  type: "object",
  allOf: [{ $ref: "#/definitions/VariableScope" }],
  properties: {
    scenario: {
      $ref: "#/definitions/Name",
    },
    description: String,
    steps: {
      type: "array",
      items: {
        $ref: "#/definitions/TestStep",
      },
    },
  },
  required: ["scenario", "steps"],
};

export const TestDefinition: Schema & {
  definitions: { [def: string]: Schema };
} = {
  type: "object",
  allOf: [{ $ref: "#/definitions/VariableScope" }],
  properties: {
    scope: {
      type: "string",
      enum: ["ResourceGroup"],
    },
    requiredVariables: {
      type: "array",
      items: {
        $ref: "#/definitions/Name",
      },
    },
    prepareSteps: {
      type: "array",
      items: {
        $ref: "#/definitions/TestStep",
      },
    },
    testScenarios: {
      type: "array",
      items: {
        $ref: "#/definitions/TestScenario",
      },
    },
    cleanUpSteps: {
      type: "array",
      items: {
        $ref: "#/definitions/TestStep",
      },
    },
  },
  required: ["testScenarios"],

  definitions: {
    Name,
    JsonPointer,
    VariableScope,
    TestStep,
    TestStepBase,
    TestStepRestBase,
    TestStepRestCall,
    TestStepRestOperation,
    TestStepArmTemplateDeployment,
    TestStepRawCall,
    ...JsonPatchOpSchemas,
    TestScenario,
  },
};
