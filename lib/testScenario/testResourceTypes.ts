import { HttpMethods } from "@azure/core-http";
import { Operation, Schema, SwaggerExample } from "../swagger/swaggerTypes";

//#region Common

type TransformRaw<T, Additional = {}, OptionalKey extends keyof T = never> = {
  [P in OptionalKey]?: T[P];
} &
  {
    [P in Exclude<keyof T, OptionalKey | keyof Additional>]-?: Exclude<T[P], undefined>;
  } &
  Additional;

export interface RawVariableScope {
  variables?: { [variableName: string]: string };
}

const variableScopeSchema: Schema = {
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

//#endregion

//#region TestStep Base

type RawTestStepBase = RawVariableScope & {
  step: string;
};

interface TestStepBase {
  isScopePrepareStep?: boolean;
}

export type TestStep = TestStepArmTemplateDeployment | TestStepRestCall | TestStepRawCall;
export type RawTestStep =
  | RawTestStepArmTemplateDeployment
  | RawTestStepRestCall
  | RawTestStepRawCall;

const testStepBaseSchema: Schema = {
  allOf: [{ $ref: "#/definitions/VariableScope" }],
  properties: {
    step: {
      type: "string",
    },
    fromStep: {
      type: "string",
    },
  },
};

const testStepSchema: Schema = {
  anyOf: [
    {
      $ref: "#/definitions/TestStepRestCall",
    },
    {
      $ref: "#/definitions/TestStepArmTemplateDeployment",
    },
    {
      $ref: "#/definitions/TestStepRawCall",
    },
  ],
};

//#endregion

//#region TestStep Arm Template Deployment

export type RawTestStepArmTemplateDeployment = RawTestStepBase & {
  armTemplateDeployment: string;
  armTemplateParameters?: string;
};

const testStepArmTemplateDeploymentSchema: Schema = {
  type: "object",
  allOf: [{ $ref: "#/definitions/TestStepBase" }],
  properties: {
    armTemplateDeployment: {
      type: "string",
    },
    armTemplateParameters: {
      type: "string",
    },
  },
  required: ["armTemplateDeployment"],
};

export type TestStepArmTemplateDeployment = TransformRaw<
  RawTestStepArmTemplateDeployment,
  {
    type: "armTemplateDeployment";
    armTemplatePayload: ArmTemplate;
    armTemplateParametersPayload?: {
      parameters: {
        [name: string]: {
          value: any;
        };
      };
    };
  } & TestStepBase,
  "armTemplateParameters"
>;

export type ArmTemplateVariableType =
  | "string"
  | "securestring"
  | "int"
  | "bool"
  | "object"
  | "secureObject"
  | "array";

export interface ArmTemplate {
  parameters?: {
    [name: string]: {
      type: ArmTemplateVariableType;
      defaultValue?: any;
    };
  };
  outputs?: {
    [name: string]: {
      condition?: string;
      type: ArmTemplateVariableType;
    };
  };
}

//#endregion

//#region TestStep RestCall

export type RawTestStepRestCall = RawTestStepBase & {
  resourceName?: string;
  exampleFile?: string;
  resourceType?: string;
  operationId?: string;
  statusCode?: number;
  resourceUpdate?: JsonPatchOp[];
  requestUpdate?: JsonPatchOp[];
  responseUpdate?: JsonPatchOp[];
  outputVariables?: {
    [variableName: string]: {
      fromResponse: string;
    };
  };
};

const testStepRestCallSchema: Schema = {
  type: "object",
  allOf: [{ $ref: "#/definitions/TestStepBase" }],
  properties: {
    type: {
      type: "string",
      enum: ["exampleFile"],
    },
    resourceName: {
      type: "string",
    },
    exampleFile: {
      type: "string",
    },
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
    outputVariables: {
      type: "array",
      items: {
        properties: {
          fromResponse: {
            type: "string",
          },
        },
      },
    },
    operationId: {
      type: "string",
    },
    statusCode: {
      type: "number",
    },
  },
  required: ["step"],
};

export type TestStepRestCall = TransformRaw<
  RawTestStepRestCall,
  {
    type: "restCall";
    operation: Operation;
    exampleId: string;
    exampleFilePath?: string;
    requestParameters: SwaggerExample["parameters"];
    responseExpected: SwaggerExample["responses"]["200"]["body"];
  } & TestStepBase,
  "exampleFile" | "resourceName"
>;

//#endregion

export type RawTestStepRawCall = RawTestStepBase & {
  method: HttpMethods;
  rawUrl: string;
  requestHeaders: { [headName: string]: string };
  requestBody: string;
  statusCode?: number;
  responseExpected?: string;
};

const testStepRawCallSchema: Schema = {
  type: "object",
  allOf: [{ $ref: "#/definitions/TestStepBase" }],
  properties: {
    type: {
      type: "string",
      enum: ["rawCall"],
    },
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
    requestBody: {
      type: "string",
    },
    statusCode: {
      type: "number",
    },
    responseExpected: {
      type: "string",
    },
  },
  required: ["method", "url", "requestHeaders", "requestBody"],
};

export type TestStepRawCall = TransformRaw<
  RawTestStepRawCall,
  {
    type: "rawCall";
  } & TestStepBase,
  "responseExpected"
>;

//#region JsonPatchOp

export interface JsonPatchOpAdd {
  add: string;
  value: any;
}

export interface JsonPatchOpRemove {
  remove: string;
  oldValue?: any;
}

export interface JsonPatchOpReplace {
  replace: string;
  value: any;
  oldValue?: any;
}

export interface JsonPatchOpCopy {
  copy: string;
  path: string;
}

export interface JsonPatchOpMove {
  move: string;
  path: string;
}

export interface JsonPatchOpTest {
  test: string;
  value: any;
}

export interface JsonPatchOpMerge {
  merge: string;
  value: { [key: string]: any };
}

export type JsonPatchOp =
  | JsonPatchOpAdd
  | JsonPatchOpRemove
  | JsonPatchOpReplace
  | JsonPatchOpCopy
  | JsonPatchOpMove
  | JsonPatchOpTest
  | JsonPatchOpMerge;

const jsonPatchOpSchemas: { [key: string]: Schema } = {
  JsonPatchOp: {
    type: "object",
    oneOf: [
      { $ref: "#/definitions/JsonPatchOpAdd" },
      { $ref: "#/definitions/JsonPatchOpRemove" },
      { $ref: "#/definitions/JsonPatchOpReplace" },
      { $ref: "#/definitions/JsonPatchOpCopy" },
      { $ref: "#/definitions/JsonPatchOpMove" },
      { $ref: "#/definitions/JsonPatchOpTest" },
      { $ref: "#/definitions/JsonPatchOpMerge" },
    ],
  },
  JsonPatchOpAdd: {
    type: "object",
    required: ["add", "value"],
    properties: {
      add: {
        type: "string",
      },
      value: {},
    },
  },
  JsonPatchOpRemove: {
    type: "object",
    required: ["remove"],
    properties: {
      remove: {
        type: "string",
      },
    },
  },
  JsonPatchOpReplace: {
    type: "object",
    required: ["replace", "value"],
    properties: {
      replace: {
        type: "string",
      },
      value: {},
    },
  },
  JsonPatchOpCopy: {
    type: "object",
    required: ["copy", "path"],
    properties: {
      copy: {
        type: "string",
      },
      path: {
        type: "string",
      },
    },
  },
  JsonPatchOpMove: {
    type: "object",
    required: ["move", "path"],
    properties: {
      move: {
        type: "string",
      },
      path: {
        type: "string",
      },
    },
  },
  JsonPatchOpTest: {
    type: "object",
    required: ["test", "value"],
    properties: {
      test: {
        type: "string",
      },
      value: {},
    },
  },
  JsonPatchOpMerge: {
    type: "object",
    required: ["merge", "value"],
    properties: {
      merge: {
        type: "string",
      },
      value: {
        type: "object",
        additionalProperties: true,
      },
    },
  },
};

//#endregion

//#region TestScenario

export type RawTestScenario = RawVariableScope & {
  description: string;
  requiredVariables?: string[];
  shareTestScope?: boolean | string;
  steps: RawTestStep[];
};

const testScenarioSchema: Schema = {
  type: "object",
  allOf: [{ $ref: "#/definitions/VariableScope" }],
  properties: {
    description: {
      type: "string",
    },
    requiredVariables: {
      type: "array",
      items: {
        type: "string",
      },
    },
    steps: {
      type: "array",
      items: {
        $ref: "#/definitions/TestStep",
      },
    },
    shareTestScope: {
      type: "string",
    },
  },
  required: ["description", "steps"],
};

export type TestScenario = TransformRaw<
  RawTestScenario,
  {
    steps: TestStep[];
    _testDef: TestDefinitionFile;
    _resolvedSteps: TestStep[];
  }
>;

//#endregion

//#region TestDefinitionFile
export type RawTestDefinitionFile = RawVariableScope & {
  scope?: "ResourceGroup";
  requiredVariables?: string[];
  prepareSteps?: RawTestStep[];
  testScenarios: RawTestScenario[];
};

export type TestDefinitionFile = TransformRaw<
  RawTestDefinitionFile,
  {
    prepareSteps: TestStep[];
    testScenarios: TestScenario[];
    _filePath: string;
  }
>;
export interface RawReport {
  executions: RawExecution[];
  timings: any;
  variables: any;
  testScenarioName?: string;
  metadata: any;
}

export interface RawExecution {
  request: RawRequest;
  response: RawResponse;
  annotation?: any;
}
export interface RawRequest {
  url: string;
  method: string;
  headers: { [key: string]: any };
  body: string;
}

export interface RawResponse {
  statusCode: number;
  headers: { [key: string]: any };
  body: string;
}

export interface TestResources {
  ["test-resources"]: Array<{ [key: string]: string }>;
}

export const TestDefinitionSchema: Schema & {
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
    VariableScope: variableScopeSchema,
    TestStep: testStepSchema,
    TestStepBase: testStepBaseSchema,
    TestStepArmTemplateDeployment: testStepArmTemplateDeploymentSchema,
    TestStepRestCall: testStepRestCallSchema,
    TestStepRawCall: testStepRawCallSchema,
    ...jsonPatchOpSchemas,
    TestScenario: testScenarioSchema,
  },
};

//#endregion
