import { Schema } from "../swagger/swaggerTypes";

export const ApiScenarioDefinition: Schema & {
  definitions: { [def: string]: Schema };
} = {
  type: "object",
  properties: {
    scope: {
      type: "string",
      enum: ["ResourceGroup"],
    },
    swaggers: {
      type: "array",
      items: {
        type: "string",
      },
    },
    variables: {
      $ref: "#/definitions/Variables",
    },
    prepareSteps: {
      type: "array",
      description: "Prepare steps before executing scenarios",
      items: {
        $ref: "#/definitions/Step",
      },
    },
    scenarios: {
      type: "array",
      description: "API scenarios",
      items: {
        $ref: "#/definitions/Scenario",
      },
      minItems: 1,
    },
    cleanUpSteps: {
      type: "array",
      description: "Clean up steps after executing scenarios",
      items: {
        $ref: "#/definitions/Step",
      },
    },
  },
  required: ["swaggers", "scenarios"],
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
    VariableType: {
      type: "string",
      enum: ["array", "bool", "int", "object", "secureString", "secureObject", "string"],
      default: "string",
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
              type: {
                $ref: "#/definitions/VariableType",
              },
            },
            required: ["type"],
            allOf: [
              {
                if: {
                  properties: {
                    type: {
                      enum: ["string", "secureString"],
                    },
                  },
                },
                then: {
                  properties: {
                    type: {},
                    value: {
                      type: "string",
                    },
                  },
                  additionalProperties: false,
                },
              },
              {
                if: {
                  properties: {
                    type: {
                      enum: ["object", "secureObject"],
                    },
                  },
                  required: ["type"],
                },
                then: {
                  oneOf: [
                    {
                      properties: {
                        type: {},
                        value: {
                          type: "object",
                        },
                      },
                      required: ["value"],
                      additionalProperties: false,
                    },
                    {
                      properties: {
                        type: {},
                        patches: {
                          type: "array",
                          items: {
                            $ref: "#/definitions/JsonPatchOp",
                          },
                        },
                      },
                      required: ["patches"],
                      additionalProperties: false,
                    },
                  ],
                },
              },
              {
                if: {
                  properties: {
                    type: {
                      const: "array",
                    },
                  },
                  required: ["type"],
                },
                then: {
                  oneOf: [
                    {
                      properties: {
                        type: {},
                        value: {
                          type: "array",
                          items: {},
                        },
                      },
                      required: ["value"],
                      additionalProperties: false,
                    },
                    {
                      properties: {
                        type: {},
                        patches: {
                          type: "array",
                          items: {
                            $ref: "#/definitions/JsonPatchOp",
                          },
                        },
                      },
                      required: ["patches"],
                      additionalProperties: false,
                    },
                  ],
                },
              },
              {
                if: {
                  properties: {
                    type: {
                      const: "bool",
                    },
                  },
                  required: ["type"],
                },
                then: {
                  properties: {
                    type: {},
                    value: {
                      type: "boolean",
                    },
                  },
                  required: ["value"],
                  additionalProperties: false,
                },
              },
              {
                if: {
                  properties: {
                    type: {
                      const: "int",
                    },
                  },
                  required: ["type"],
                },
                then: {
                  properties: {
                    type: {},
                    value: {
                      type: "integer",
                    },
                  },
                  required: ["value"],
                  additionalProperties: false,
                },
              },
            ],
          },
        ],
      },
    },
    Scenario: {
      type: "object",
      properties: {
        scenario: {
          $ref: "#/definitions/Name",
          description: "Name of the scenario",
        },
        description: {
          type: "string",
          description: "A long description of the scenario",
        },
        swaggers: {
          type: "array",
          items: {
            type: "string",
          },
        },
        variables: {
          $ref: "#/definitions/Variables",
        },
        shareScope: {
          type: "boolean",
          description: "Whether to share the scope and prepareSteps with other scenarios",
          default: true,
        },
        steps: {
          type: "array",
          items: {
            $ref: "#/definitions/Step",
          },
        },
      },
      required: ["steps"],
      additionalProperties: false,
    },
    Step: {
      oneOf: [
        {
          $ref: "#/definitions/StepOperation",
        },
        {
          $ref: "#/definitions/StepExample",
        },
        {
          $ref: "#/definitions/StepArmTemplate",
        },
        {
          $ref: "#/definitions/StepArmDeploymentScript",
        },
      ],
    },
    StepBase: {
      type: "object",
      properties: {
        step: {
          $ref: "#/definitions/Name",
          description: "The name of the step that uniquely identifies it",
        },
        description: {
          type: "string",
          description: "A brief explanation about the step",
        },
        variables: {
          $ref: "#/definitions/Variables",
        },
        outputVariables: {
          type: "object",
          propertyNames: {
            $ref: "#/definitions/Name",
          },
          additionalProperties: {
            properties: {
              type: {
                $ref: "#/definitions/VariableType",
              },
              fromRequest: {
                $ref: "#/definitions/JsonPointer",
              },
              fromResponse: {
                $ref: "#/definitions/JsonPointer",
              },
            },
          },
        },
      },
    },
    StepOperation: {
      type: "object",
      allOf: [
        {
          $ref: "#/definitions/StepBase",
        },
      ],
      properties: {
        operationId: {
          type: "string",
        },
        swagger: {
          type: "string",
        },
        parameters: {
          type: "object",
          additionalProperties: true,
        },
        step: {},
        description: {},
        variables: {},
        outputVariables: {},
      },
      required: ["operationId"],
      additionalProperties: false,
    },
    StepExample: {
      type: "object",
      allOf: [
        {
          $ref: "#/definitions/StepBase",
        },
      ],
      properties: {
        exampleFile: {
          type: "string",
        },
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
        step: {},
        description: {},
        variables: {},
        outputVariables: {},
      },
      required: ["exampleFile"],
      additionalProperties: false,
    },
    StepArmTemplate: {
      type: "object",
      allOf: [
        {
          $ref: "#/definitions/StepBase",
        },
      ],
      properties: {
        armTemplate: {
          type: "string",
        },
        step: {},
        description: {},
        variables: {},
        outputVariables: {},
      },
      required: ["armTemplate"],
      additionalProperties: false,
    },
    StepArmDeploymentScript: {
      type: "object",
      allOf: [
        {
          $ref: "#/definitions/StepBase",
        },
      ],
      properties: {
        armDeploymentScript: {
          type: "string",
        },
        arguments: {
          type: "string",
        },
        environmentVariables: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
              },
              value: {
                type: "string",
              },
            },
            required: ["name", "value"],
          },
        },
        step: {},
        description: {},
        variables: {},
        outputVariables: {},
      },
      required: ["armDeploymentScript"],
      additionalProperties: false,
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
