import { Operation, SwaggerExample } from "../swagger/swaggerTypes";

//#region Common

type TransformRaw<T, Additional = {}, OptionalKey extends keyof T = never> = {
  [P in OptionalKey]?: T[P];
} &
  {
    [P in Exclude<keyof T, OptionalKey | keyof Additional>]-?: Exclude<T[P], undefined>;
  } &
  Additional;

export type VarType = Variable["type"];

export type VarValue = boolean | number | string | VarValue[] | { [key: string]: VarValue };

export type Variable =
  | BoolVariable
  | IntVariable
  | StringVariable
  | SecureStringVariable
  | ArrayVariable
  | ObjectVariable
  | SecureObjectVariable;

type StringVariable = {
  type: "string";
  value?: string;
};

type SecureStringVariable = {
  type: "secureString";
  value?: string;
};

type BoolVariable = {
  type: "bool";
  value?: boolean;
};

type IntVariable = {
  type: "int";
  value?: number;
};

type ObjectVariable = {
  type: "object";
  value?: { [key: string]: VarValue };
  patches?: JsonPatchOp[];
};

type SecureObjectVariable = {
  type: "secureObject";
  value?: { [key: string]: VarValue };
  patches?: JsonPatchOp[];
};

type ArrayVariable = {
  type: "array";
  value?: VarValue[];
  patches?: JsonPatchOp[];
};

export type RawVariableScope = {
  variables?: {
    [variableName: string]: string | Variable;
  };
};

export type VariableScope = {
  variables: {
    [variableName: string]: Variable;
  };
  requiredVariables: string[];
  secretVariables: string[];
};

export type OutputVariables = {
  [variableName: string]: {
    type?: VarType;
    fromRequest: string;
    fromResponse: string;
  };
};

//#endregion

//#region Step Base

type RawStepBase = RawVariableScope & {
  step?: string;
  description?: string;
  outputVariables?: OutputVariables;
};

type StepBase = VariableScope & {
  isPrepareStep?: boolean;
  isCleanUpStep?: boolean;
};

export type Step = StepRestCall | StepArmTemplate;
export type RawStep = RawStepOperation | RawStepExample | RawStepArmTemplate | RawStepArmScript;

//#endregion

//#region Step RestCall

export type RawStepExample = RawStepBase & {
  exampleFile: string;
  resourceUpdate?: JsonPatchOp[];
  requestUpdate?: JsonPatchOp[];
  responseUpdate?: JsonPatchOp[];
};

export type RawStepOperation = RawStepBase & {
  operationId: string;
  swagger?: string;
  parameters?: { [parameterName: string]: VarValue };
  responses?: SwaggerExample["responses"];
};

export type StepRestCall = StepBase & {
  type: "restCall";
  step: string;
  description?: string;
  operationId: string;
  operation: Operation;
  exampleFile?: string;
  requestParameters: RawStepOperation["parameters"];
  responseExpected: RawStepOperation["responses"];
  outputVariables?: OutputVariables;
};

//#endregion

//#region Step Arm Deployment Script
export type RawStepArmScript = RawStepBase & {
  armDeploymentScript: string;
  arguments?: string;
  environmentVariables?: Array<{
    name: string;
    value: string;
  }>;
};
//#endregion

//#region Step Arm Template

export type ArmTemplateVariableType =
  | "string"
  | "securestring"
  | "int"
  | "bool"
  | "object"
  | "secureObject"
  | "array";

export type RawStepArmTemplate = RawStepBase & {
  armTemplate: string;
};

export type StepArmTemplate = TransformRaw<
  RawStepArmTemplate,
  StepBase & {
    type: "armTemplateDeployment";
    armTemplatePayload: ArmTemplate;
  },
  "description"
>;

export type ArmResource = {
  name: string;
  apiVersion: string;
  type: string;
  location?: string;
  properties?: object;
};

export type ArmDeploymentScriptResource = ArmResource & {
  type: "Microsoft.Resources/deploymentScripts";
  kind: "AzurePowerShell" | "AzureCLI";
  identity?: {
    type: "UserAssigned";
    userAssignedIdentities: {
      [name: string]: {};
    };
  };
  properties: {
    arguments?: string;
    azPowerShellVersion?: string;
    azCliVersion?: string;
    scriptContent: string;
    forceUpdateTag?: string;
    timeout?: string;
    cleanupPreference?: string;
    retentionInterval?: string;
    environmentVariables?: Array<{
      name: string;
      value?: string;
      secureValue?: string;
    }>;
  };
};

export type ArmTemplate = {
  $schema?: string;
  contentVersion?: string;
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
  resources?: ArmResource[];
};

//#endregion

//#region JsonPatchOp

export type JsonPatchOpAdd = {
  add: string;
  value: any;
};

export type JsonPatchOpRemove = {
  remove: string;
  oldValue?: any;
};

export type JsonPatchOpReplace = {
  replace: string;
  value: any;
  oldValue?: any;
};

export type JsonPatchOpCopy = {
  copy: string;
  from: string;
};

export type JsonPatchOpMove = {
  move: string;
  from: string;
};

export type JsonPatchOpTest = {
  test: string;
  value: any;
};

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
  scenario?: string;
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
  swaggers: string[];
  prepareSteps?: RawStep[];
  scenarios: RawScenario[];
  cleanUpSteps?: RawStep[];
};

export type ScenarioDefinition = TransformRaw<
  RawScenarioDefinition,
  VariableScope & {
    prepareSteps: Step[];
    scenarios: Scenario[];
    cleanUpSteps: Step[];
    _filePath: string;
  }
>;
//#endregion

//#region Runner specific types
export type RawReport = {
  executions: RawExecution[];
  timings: any;
  variables: any;
  testScenarioName?: string;
  metadata: any;
};

export type RawExecution = {
  request: RawRequest;
  response: RawResponse;
  annotation?: any;
};
export type RawRequest = {
  url: string;
  method: string;
  headers: { [key: string]: any };
  body: string;
};

export type RawResponse = {
  statusCode: number;
  headers: { [key: string]: any };
  body: string;
};

export type TestResources = {
  ["test-resources"]: Array<{ [key: string]: string }>;
};

//#endregion
