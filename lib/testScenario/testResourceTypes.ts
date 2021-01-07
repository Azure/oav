import { Operation, Schema, SwaggerExample } from "../swagger/swaggerTypes";

export type TestDefinitionFile = {
  scope: 'ResourceGroup';
  prepareSteps: TestStep[];
  testScenarios: TestScenario[];

  _filePath: string;
};

export type VariableScope = {
  variables: { [variableName: string]: string };
}

export type TestStepBase = VariableScope & {
  isScopePrepareStep: boolean;
};

export type TestStepArmTemplateDeployment = TestStepBase & {
  type: "armTemplateDeployment";
  armTemplateDeployment: string;

  armTemplatePayload: any;
};

export type TestStepExampleFileRestCall = TestStepBase & {
  type: "exampleFile";
  exampleFile: string;
  operationId?: string;
  replace: ExampleReplace[];

  operation: Operation;
  exampleFileContent: SwaggerExample;
  url: string;
};

export type ExampleReplace = {
  pathInPayload?: string; // Format: json path
  pathInExample?: string; // Format: json path
  to: string;
};

export type TestStep = TestStepArmTemplateDeployment | TestStepExampleFileRestCall;

export type TestScenario = {
  description: string;
  shareTestScope: true;
  steps: TestStep[];

  _testDef: TestDefinitionFile;
  _resolvedSteps: TestStep[];
};

export const TestDefinitionSchema: Schema & {
  definitions: { [def: string]: Schema };
} = {
  type: "object",
  properties: {
    scope: {
      type: "string",
      enum: [
        "ResourceGroup"
      ],
      default: "ResourceGroup"
    },
    prepareSteps: {
      type: "array",
      items: {
        $ref: "#/definitions/TestStep"
      },
      default: []
    },
    testScenarios: {
      type: "array",
      items: {
        $ref: "#/definitions/TestScenario"
      }
    }
  },
  required: ["testScenarios"],

  definitions: {
    TestScenario: {
      type: "object",
      properties: {
        description: {
          type: "string"
        },
        steps: {
          type: "array",
          items: {
            $ref: "#/definitions/TestStep"
          }
        },
        shareTestScope: {
          type: "string",
          default: "sharedDefaultScope"
        }
      },
      required: ["description", "steps"]
    },
    TestStepBase: {
      type: "object",
      properties: {
        variables: {
          type: "object",
          additionalProperties: {
            type: "string",
          },
        },
      },
      default: {
        variables: {},
      },
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
      }
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
          type: "string"
        },
      }
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
          type: "string"
        },
        pathInExample: {
          type: "string"
        },
        to: {
          type: "string"
        }
      },
      required: ["to"]
    }
  },
};
