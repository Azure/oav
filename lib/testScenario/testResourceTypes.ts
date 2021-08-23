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
          secret?: boolean;
          defaultValue?: string;
        };
  };
}

export interface VariableScope {
  variables: {
    [variableName: string]: {
      value?: string;
      secret: boolean;
      required: boolean;
    }
  }
}

export interface OutputVariables {
  [variableName: string]: {
    fromResponse: string;
  };
}

//#endregion

//#region TestStep Base

type RawTestStepBase = RawVariableScope & {
  description?: string;
  outputVariables?: OutputVariables;
};

type TestStepBase = VariableScope & {
  name: string;
  isPrepareStep?: boolean;
  isCleanUpStep?: boolean;
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
  operationId: string;
  resourceName: string;
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

//#region TestStep Raw REST Call
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
  shareScope?: boolean;
  description?: string;
  steps: { [stepName: string]: RawTestStep }[];
};

export type TestScenario = TransformRaw<
  RawTestScenario,
  {
    name: string;
    steps: TestStep[];
    _testDef: TestDefinitionFile;
    _resolvedSteps: TestStep[];
  } & VariableScope
>;

//#endregion

//#region TestDefinitionFile
export type RawTestDefinitionFile = RawVariableScope & {
  scope?: "ResourceGroup";
  prepareSteps?: { [stepName: string]: RawTestStep }[];
  testScenarios: RawTestScenario[];
  cleanUpSteps?: { [stepName: string]: RawTestStep }[];
};

export type TestDefinitionFile = TransformRaw<
  RawTestDefinitionFile,
  {
    prepareSteps: TestStep[];
    testScenarios: TestScenario[];
    cleanUpSteps: TestStep[];
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
