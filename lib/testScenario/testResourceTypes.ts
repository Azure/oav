import { Operation, Schema, SwaggerExample } from "../swagger/swaggerTypes";

export interface VariableScope {
  variables: { [variableName: string]: string };
}

export type TestDefinitionFile = VariableScope & {
  scope: "ResourceGroup";
  requiredVariables: string[];
  prepareSteps: TestStep[];
  testScenarios: TestScenario[];

  _filePath: string;
};

export type TestStepBase = VariableScope & {
  isScopePrepareStep: boolean;
};

export type TestStepArmTemplateDeployment = TestStepBase & {
  type: "armTemplateDeployment";
  armTemplateDeployment: string;
  armTemplateParameters?: string;

  armTemplatePayload: ArmTemplate;
  armTemplateParametersPayload?: {
    parameters: {
      [name: string]: {
        value: any;
      };
    };
  };
};

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

export type TestStepExampleFileRestCall = TestStepBase & {
  type: "exampleFile";
  exampleFile: string;
  operationId?: string;
  replace: ExampleReplace[];

  operation: Operation;
  exampleId: string;
  exampleFilePath: string;
  exampleFileContent: SwaggerExample;
  exampleTemplate: SwaggerExample;
};

export interface ExampleReplace {
  pathInBody?: string; // Format: json path
  pathInExample?: string; // Format: json path
  to: string;
}

export type TestStep = TestStepArmTemplateDeployment | TestStepExampleFileRestCall;

export type TestScenario = VariableScope & {
  description: string;
  requiredVariables: string[];
  shareTestScope: boolean | string;
  steps: TestStep[];

  _testDef: TestDefinitionFile;
  _resolvedSteps: TestStep[];
};

export interface RawReport {
  executions: RawExecution[];
  variables: any;
}

export interface RawExecution {
  request: RawRequest;
  response: RawResponse;
  annotation?: string;
}
export interface RawRequest {
  url: string;
  method: string;
  headers: Array<{ [key: string]: string }>;
  body: string;
}

export interface RawResponse {
  statusCode: string;
  headers: Array<{ [key: string]: string }>;
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
      default: "ResourceGroup",
    },
    requiredVariables: {
      type: "array",
      items: {
        type: "string",
      },
      default: [],
    },
    prepareSteps: {
      type: "array",
      items: {
        $ref: "#/definitions/TestStep",
      },
      default: [],
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
    VariableScope: {
      type: "object",
      properties: {
        variables: {
          type: "object",
          additionalProperties: {
            type: "string",
          },
          default: {},
        },
      },
    },
    TestScenario: {
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
          default: [],
        },
        steps: {
          type: "array",
          items: {
            $ref: "#/definitions/TestStep",
          },
        },
        shareTestScope: {
          type: "string",
          default: "sharedDefaultScope",
        },
      },
      required: ["description", "steps"],
    },
    TestStepBase: {
      allOf: [{ $ref: "#/definitions/VariableScope" }],
    },
    TestStepArmTemplateDeployment: {
      type: "object",
      allOf: [{ $ref: "#/definitions/TestStepBase" }],
      properties: {
        type: {
          type: "string",
          enum: ["armTemplateDeployment"],
          default: "armTemplateDeployment",
        },
        armTemplateDeployment: {
          type: "string",
        },
        armTemplateParameters: {
          type: "string",
        },
      },
    },
    TestStepExampleFileRestCall: {
      type: "object",
      allOf: [{ $ref: "#/definitions/TestStepBase" }],
      properties: {
        type: {
          type: "string",
          enum: ["exampleFile"],
          default: "exampleFile",
        },
        exampleFile: {
          type: "string",
        },
        replace: {
          type: "array",
          items: {
            $ref: "#/definitions/ExampleReplace",
          },
          default: [],
        },
        operationId: {
          type: "string",
        },
      },
    },
    TestStep: {
      type: "object",
      oneOf: [
        {
          $ref: "#/definitions/TestStepArmTemplateDeployment",
        },
        {
          $ref: "#/definitions/TestStepExampleFileRestCall",
        },
      ],
    },
    ExampleReplace: {
      type: "object",
      properties: {
        pathInPayload: {
          type: "string",
        },
        pathInExample: {
          type: "string",
        },
        to: {
          type: "string",
        },
      },
      required: ["to"],
    },
  },
};
