import { Item } from "postman-collection";
import { StepArmTemplate, StepResponseAssertion, StepRestCall } from "./apiScenarioTypes";

type HttpMethod = "put" | "get" | "post" | "patch" | "delete" | "head" | "option";
type OpenapiType = "Dataplane" | "Management";
type AssertMatchParameter = { item?: Item; step?: StepArmTemplate | StepRestCall; opts?: any };

export type CallType = "lroPolling" | "lroFinalGet" | "stepCall" | "armTemplateCall";
export type AssertionRule = {
  name: string;
  assertion?: { stepAssertion?: StepResponseAssertion; postmanTestScript?: string[] };
  conditions: {
    openapiTypes: OpenapiType | OpenapiType[];
    httpMethods: HttpMethod | HttpMethod[];
    callTypes: CallType | CallType[];
    isAsync?: boolean;
    match?: (params: AssertMatchParameter) => boolean;
  };
};

// RPC-Async-V1-08 Async PATCH should return 202.
const AsyncPatchShouldReturn202: AssertionRule = {
  name: "AsyncPatchShouldReturn202",
  assertion: { stepAssertion: { 202: {} } },
  conditions: {
    openapiTypes: "Management",
    isAsync: true,
    httpMethods: "patch",
    callTypes: "stepCall",
  },
};

// RPC-Async-V1-09 Async DELETE should return 202.
const AsyncDeleteShouldReturn202: AssertionRule = {
  name: "AsyncDeleteShouldReturn202",
  assertion: { stepAssertion: { 202: {} } },
  conditions: {
    openapiTypes: "Management",
    isAsync: true,
    httpMethods: "delete",
    callTypes: "stepCall",
  },
};

// RPC-Async-V1-11 Async POST should return 202.
const AsyncPostShouldReturn202: AssertionRule = {
  name: "AsyncPostShouldReturn202",
  assertion: { stepAssertion: { 202: {} } },
  conditions: {
    openapiTypes: "Management",
    isAsync: true,
    httpMethods: "post",
    callTypes: "stepCall",
  },
};

//RPC-Async-V1-01 Async PUT should return 201/200.
const AsyncPutShouldReturn201: AssertionRule = {
  name: "AsyncPutShouldReturn201",
  assertion: { stepAssertion: { 201: {}, 200: {} } },
  conditions: {
    openapiTypes: "Management",
    isAsync: true,
    httpMethods: "put",
    callTypes: "stepCall",
  },
};

// RPC-Async-V1-07 Location header must be supported for all async operations that return 202. Azure-AsyncOperation header is optional.
const Async202ResponseShouldIncludeLocationHeader: AssertionRule = {
  name: "Async202ResponseShouldIncludeLocationHeader",
  assertion: {
    postmanTestScript: ['if(pm.response.code === 202) { pm.response.to.have.header("Location");}'],
  },
  conditions: {
    openapiTypes: "Management",
    isAsync: true,
    httpMethods: ["put", "patch", "post", "delete"],
    callTypes: "stepCall",
  },
};

const ArmTemplateStatusCodeCheck: AssertionRule = {
  name: "ArmTemplateStatusCodeCheck",
  assertion: {
    postmanTestScript: [
      "pm.response.to.be.success;",
      'pm.expect(pm.response.json().status).to.be.oneOf(["Succeeded", "Accepted", "Running", "Ready", "Creating", "Created", "Deleting", "Deleted", "Canceled", "Updating"]);',
    ],
  },
  conditions: {
    openapiTypes: "Management",
    httpMethods: "put",
    callTypes: "armTemplateCall",
  },
};

const DetailResponseLog: AssertionRule = {
  name: "DetailResponseLog",
  assertion: {
    postmanTestScript: [
      "console.log(pm.response.text());",
    ],
  },
  conditions: {
    openapiTypes: ["Management", "Dataplane"],
    httpMethods: ["put", "get", "delete", "patch", "option", "post", "head"],
    callTypes: ["armTemplateCall", "lroFinalGet", "lroPolling", "stepCall"],
    match: (params: AssertMatchParameter) => {
      return params.opts?.verbose === true;
    },
  },
};

// RPC-Async-V1-06 x-ms-long-running-operation-options should indicate the type of response header to track the async operation.
// Here is for checking the case of final-state-via:azureAsyncOperation.
const AzureAsyncOperationFinalStateCheck: AssertionRule = {
  name: "AzureAsyncOperationFinalStateCheck",
  assertion: {
    stepAssertion: {
      "200": [{ test: "/body/properties", expression: "to.be.not.undefined" }],
    },
  },
  conditions: {
    openapiTypes: "Management",
    httpMethods: ["put"],
    callTypes: "lroFinalGet",
    match: (params: AssertMatchParameter) => {
      const step = params.step;
      return (
        step?.type === "restCall" &&
        step.operation?.["x-ms-long-running-operation-options"]?.["final-state-via"] ===
          "azure-async-operation"
      );
    },
  },
};

export const postmanArmRules = [
  AsyncPatchShouldReturn202,
  AsyncDeleteShouldReturn202,
  AsyncPostShouldReturn202,
  AsyncPutShouldReturn201,
  Async202ResponseShouldIncludeLocationHeader,
  ArmTemplateStatusCodeCheck,
  AzureAsyncOperationFinalStateCheck,
  DetailResponseLog,
];
