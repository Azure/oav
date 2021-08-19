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
  variables?: { [variableName: string]: string };
}

export interface OutputVariables {
  [variableName: string]: {
    fromResponse: string;
  };
}

//#endregion

//#region TestStep Base

type RawTestStepBase = RawVariableScope & {
  step: string;
  description?: string;
  outputVariables?: OutputVariables;
};

interface TestStepBase {
  isScopePrepareStep?: boolean;
  isScopeCleanUpStep?: boolean;
}

type RawTestStepRestBase = RawTestStepBase & {
  statusCode?: number;
  resourceUpdate?: JsonPatchOp[];
  requestUpdate?: JsonPatchOp[];
  responseUpdate?: JsonPatchOp[];
};

export type TestStep = TestStepRestCall | TestStepArmTemplateDeployment | TestStepRawCall;
export type RawTestStep =
  | RawTestStepRestCall
  | RawTestStepRestOperation
  | RawTestStepArmTemplateDeployment
  | RawTestStepRawCall;

//#endregion

//#region TestStep RestCall

export type RawTestStepRestCall = RawTestStepRestBase & {
  exampleFile: string;
  resourceName?: string;
};

export type TestStepRestCall = TransformRaw<
  RawTestStepRestCall,
  {
    type: "restCall";
    operationId: string;
    operation: Operation;
    resourceType: string;
    exampleId: string;
    exampleFilePath?: string;
    requestParameters: SwaggerExample["parameters"];
    responseExpected: SwaggerExample["responses"]["200"]["body"];
  } & TestStepBase,
  "exampleFile" | "resourceName" | "description"
>;

//#endregion

//#region TestStep Named Resource Operation
export type RawTestStepRestOperation = RawTestStepRestBase & {
  resourceName: string;
  operationId: string;
};
//#endregion

//#region TestStep Arm Template Deployment

export type RawTestStepArmTemplateDeployment = RawTestStepBase & {
  armTemplateDeployment: string;
  armTemplateParameters?: string;
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
  "armTemplateParameters" | "description"
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

//#region TestSTep Raw REST Call
export type RawTestStepRawCall = RawTestStepBase & {
  method: HttpMethods;
  rawUrl: string;
  requestHeaders: { [headName: string]: string };
  requestBody: string;
  statusCode?: number;
  responseExpected?: string;
};

export type TestStepRawCall = TransformRaw<
  RawTestStepRawCall,
  {
    type: "rawCall";
  } & TestStepBase,
  "responseExpected" | "description"
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

//#region TestScenario

export type RawTestScenario = RawVariableScope & {
  scenario: string;
  description?: string;
  requiredVariables?: string[]; // TODO remove?
  steps: RawTestStep[];
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
  cleanUpSteps?: RawTestStep[];
};

export type TestDefinitionFile = TransformRaw<
  RawTestDefinitionFile,
  {
    prepareSteps: TestStep[];
    testScenarios: TestScenario[];
    cleanUpSteps: TestStep[];
    _filePath: string;
  }
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
