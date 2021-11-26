import { HttpMethods } from "@azure/core-http";
import { Operation, SwaggerExample } from "../swagger/swaggerTypes";

//#region Common

type TransformRaw<T, Additional = {}, OptionalKey extends keyof T = never> = {
  [P in OptionalKey]?: T[P];
} &
  {
    [P in Exclude<keyof T, OptionalKey | keyof Additional>]-?: Exclude<T[P], undefined>;
  } &
  Additional;

export interface RawVariableScope {
  variables?: {
    [variableName: string]:
      | string
      | {
          type?: VariableType;
          defaultValue?: string;
        };
  };
}

export interface VariableScope {
  variables: { [variableName: string]: string };
  requiredVariables: string[];
  secretVariables: string[];
}

export interface OutputVariables {
  [variableName: string]: {
    type?: VariableType;
    fromResponse: string;
  };
}

//#endregion

//#region Step Base

type RawStepBase = RawVariableScope & {
  step: string;
  description?: string;
  outputVariables?: OutputVariables;
};

type StepBase = VariableScope & {
  isPrepareStep?: boolean;
  isCleanUpStep?: boolean;
};

type RawStepRestBase = RawStepBase & {
  statusCode?: number;
  resourceUpdate?: JsonPatchOp[];
  requestUpdate?: JsonPatchOp[];
  responseUpdate?: JsonPatchOp[];
};

export type Step = StepRestCall | StepArmTemplate | StepRawCall;
export type RawStep =
  | RawStepRestCall
  | RawStepRestOperation
  | RawStepArmTemplate
  | RawStepArmScript
  | RawStepRawCall;

//#endregion

//#region Step RestCall

export type RawStepRestCall = RawStepRestBase & {
  exampleFile: string;
  resourceName?: string;
};

export type StepRestCall = TransformRaw<
  RawStepRestCall,
  {
    type: "restCall";
    operationId: string;
    operation: Operation;
    exampleName: string;
    exampleFilePath?: string;
    requestParameters: SwaggerExample["parameters"];
    expectedResponse: SwaggerExample["responses"]["200"]["body"];
  } & StepBase,
  "exampleFile" | "resourceName" | "description"
>;

//#endregion

//#region Step Named Resource Operation
export type RawStepRestOperation = RawStepRestBase & {
  operationId: string;
  resourceName: string;
};
//#endregion

//#region Step Arm Script Template
export type RawStepArmScript = RawStepBase & {
  armDeploymentScript: string;
  arguments?: string;
  environmentVariables?: Array<{
    name: string;
    value: string;
  }>;
};
//#endregion

//#region Step Arm Template Deployment

export type RawStepArmTemplate = RawStepBase & {
  armTemplate: string;
};

export type StepArmTemplate = TransformRaw<
  RawStepArmTemplate,
  {
    type: "armTemplateDeployment";
    armTemplatePayload: ArmTemplate;
  } & StepBase,
  "description"
>;

export type VariableType = "string" | "secureString";

export type ArmTemplateVariableType =
  | "string"
  | "securestring"
  | "int"
  | "bool"
  | "object"
  | "secureObject"
  | "array";

export type ArmScriptKind = "AzurePowerShell" | "AzureCLI";

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
  resources?: Array<{
    name: string;
    kind: ArmScriptKind;
    properties: {
      arguments?: string;
      azPowerShellVersion?: string;
      azCliVersion?: string;
      scriptContent: string;
      environmentVariables: Array<{
        name: string;
        value?: string;
        secureValue?: string;
      }>;
    };
  }>;
}

//#endregion

//#region Step Raw REST Call
export type RawStepRawCall = RawStepBase & {
  method: HttpMethods;
  rawUrl: string;
  requestHeaders: { [headName: string]: string };
  requestBody: string;
  statusCode?: number;
  expectedResponse?: string;
};

export type StepRawCall = TransformRaw<
  RawStepRawCall,
  {
    type: "rawCall";
  } & StepBase,
  "expectedResponse" | "description"
>;
//#endregion

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
  from: string;
}

export interface JsonPatchOpMove {
  move: string;
  from: string;
}

export interface JsonPatchOpTest {
  test: string;
  value: any;
}

export type JsonPatchOp =
  | JsonPatchOpAdd
  | JsonPatchOpRemove
  | JsonPatchOpReplace
  | JsonPatchOpCopy
  | JsonPatchOpMove
  | JsonPatchOpTest;

//#endregion

//#region Scenario

export type RawScenario = RawVariableScope & {
  scenario: string;
  shareScope?: boolean;
  description?: string;
  steps: RawStep[];
};

export type Scenario = TransformRaw<
  RawScenario,
  {
    steps: Step[];
    _scenarioDef: ScenarioDefinition;
    _resolvedSteps: Step[];
  } & VariableScope
>;

//#endregion

//#region ScenarioDefinitionFile
export type RawScenarioDefinition = RawVariableScope & {
  scope?: "ResourceGroup";
  prepareSteps?: RawStep[];
  scenarios: RawScenario[];
  cleanUpSteps?: RawStep[];
};

export type ScenarioDefinition = TransformRaw<
  RawScenarioDefinition,
  {
    prepareSteps: Step[];
    scenarios: Scenario[];
    cleanUpSteps: Step[];
    _filePath: string;
  } & VariableScope
>;
//#endregion

//#region Runner specific types
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

//#endregion
