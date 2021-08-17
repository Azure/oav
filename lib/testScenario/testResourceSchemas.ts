import { Schema } from "../swagger/swaggerTypes";

const String: Schema = {
  type: "string",
};

const Number: Schema = {
  type: "number",
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
      additionalProperties: {
        type: "string",
      },
    },
  },
};

const TestStepBase: Schema = {
  allOf: [{ $ref: "#/definitions/VariableScope" }],
  properties: {
    step: Name,
    description: String,
    outputVariables: {
      type: "object",
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
  allOf: [{ $ref: "#/definitions/TestStepBase" }],
  properties: {
    exampleFile: String,
    resourceName: Name,
    resourceUpdate: {
      type: "array",
      items: {
        $ref: "#/definitions/JsonPatchOp",
      },
    },
    requestUpdate: {
      type: "array",
      items: {
        $ref: "#/definitions/JsonPatchOp",
      },
    },
    responseUpdate: {
      type: "array",
      items: {
        $ref: "#/definitions/JsonPatchOp",
      },
    },
    statusCode: Number,
  },
  required: ["exampleFile"],
};

const TestStepOperation: Schema = {
  type: "object",
  allOf: [{ $ref: "#/definitions/TestStepBase" }],
  properties: {
    operationId: Name,
    resourceName: Name,
    resourceUpdate: {
      type: "array",
      items: {
        $ref: "#/definitions/JsonPatchOp",
      },
    },
    requestUpdate: {
      type: "array",
      items: {
        $ref: "#/definitions/JsonPatchOp",
      },
    },
    responseUpdate: {
      type: "array",
      items: {
        $ref: "#/definitions/JsonPatchOp",
      },
    },
    statusCode: Number,
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
    statusCode: Number,
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
      { $ref: "#/definitions/JsonPatchOpMerge" },
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
    required: ["copy", "path"],
    properties: {
      copy: {
        $ref: "#/definitions/JsonPointer",
      },
      path: {
        $ref: "#/definitions/JsonPointer",
      },
    },
  },
  JsonPatchOpMove: {
    type: "object",
    required: ["move", "path"],
    properties: {
      move: {
        $ref: "#/definitions/JsonPointer",
      },
      path: {
        $ref: "#/definitions/JsonPointer",
      },
    },
  },
  JsonPatchOpMerge: {
    type: "object",
    required: ["merge", "value"],
    properties: {
      merge: {
        $ref: "#/definitions/JsonPointer",
      },
      value: {
        type: "object",
        additionalProperties: true,
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
    scenario: Name,
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
        type: "string",
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
  },
  required: ["testScenarios"],

  definitions: {
    JsonPointer,
    VariableScope,
    TestStep,
    TestStepBase,
    TestStepRestCall,
    TestStepOperation,
    TestStepArmTemplateDeployment,
    TestStepRawCall,
    TestScenario,
    ...JsonPatchOpSchemas,
  },
};
