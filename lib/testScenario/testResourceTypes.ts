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
};

//#endregion

//#region TestStep Base

type RawTestStepBase = RawVariableScope & {
  step: string;
  type?: string;
  description?: string;
  outputVariables?: OutputVariables;
};

interface TestStepBase {
  isScopePrepareStep?: boolean;
}

export type TestStep = TestStepRestCall | TestStepArmTemplateDeployment | TestStepRawCall;
export type RawTestStep =
  | RawTestStepRestCall
  | RawTestStepOperation
  | RawTestStepArmTemplateDeployment
  | RawTestStepRawCall;

//#endregion

//#region TestStep RestCall

export type RawTestStepRestCall = RawTestStepBase & {
  type: "basic",
  exampleFile: string;
  resourceName?: string;
  statusCode?: number;
  resourceUpdate?: JsonPatchOp[];
  requestUpdate?: JsonPatchOp[];
  responseUpdate?: JsonPatchOp[];
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


//#region TestStep Named Resource Operation
export type RawTestStepOperation = RawTestStepBase & {
  type: "operation";
  resourceName: string;
  operationId: string;
  statusCode?: number;
  resourceUpdate?: JsonPatchOp[];
  requestUpdate?: JsonPatchOp[];
  responseUpdate?: JsonPatchOp[];
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

//#region TestSTep Raw REST Call
export type RawTestStepRawCall = RawTestStepBase & {
  type: "rawCall";
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
  "responseExpected"
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
  path: string;
}

export interface JsonPatchOpMove {
  move: string;
  path: string;
}

export interface JsonPatchOpMerge {
  merge: string;
  value: { [key: string]: any };
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
  | JsonPatchOpMerge
  | JsonPatchOpTest;

//#endregion

//#region TestScenario

export type RawTestScenario = RawVariableScope & {
  description: string;
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
};

export type TestDefinitionFile = TransformRaw<
  RawTestDefinitionFile,
  {
    prepareSteps: TestStep[];
    testScenarios: TestScenario[];
    _filePath: string;
  }
>;
//#endregion

//#region Runner Types
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
