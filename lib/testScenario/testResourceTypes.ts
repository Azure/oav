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
  step?: string;
};

interface TestStepBase {
  isScopePrepareStep?: boolean;
}

export type TestStep = TestStepArmTemplateDeployment | TestStepRestCall;
export type RawTestStep = RawTestStepArmTemplateDeployment | RawTestStepRestCall;

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
  oneOf: [
    {
      $ref: "#/definitions/TestStepRestCall",
    },
    {
      $ref: "#/definitions/TestStepArmTemplateDeployment",
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
  operationId?: string;
  statusCode?: number;
  resourceUpdate?: JsonPatchOp[];
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
    responseExpected: SwaggerExample["responses"]["200"];
  } & TestStepBase,
  "exampleFile" | "resourceName"
>;

//#endregion

//#region JsonPatchOp

export interface JsonPatchOpAdd {
  add: string;
  value: any;
}

export interface JsonPatchOpRemove {
  remove: string;
}

export interface JsonPatchOpReplace {
  replace: string;
  value: any;
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
  variables: any;
  testScenarioName: string;
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
  statusCode: string;
  headers: { [key: string]: any };
  body: string;
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
    ...jsonPatchOpSchemas,
    TestScenario: testScenarioSchema,
  },
};

//#endregion
