import { StepResponseAssertion } from "./apiScenarioTypes";

type HttpMethod = "put" | "get" | "post" | "patch" | "delete";
export type AssertionRule = {
  name: string;
  category: "Dataplane" | "Management";
  assertion?: StepResponseAssertion;
  postmanTest?: string[];
  isAsync: boolean;
  httpMethods: HttpMethod | HttpMethod[];
  callType: "lroPolling" | "lroFinalGet" | "stepCall";
};

// RPC-Async-V1-08 Async PATCH should return 202.
const AsyncPatchShouldReturn202: AssertionRule = {
  name: "AsyncPatchShouldReturn202",
  category: "Management",
  assertion: { 202: {} },
  isAsync: true,
  httpMethods: "patch",
  callType: "stepCall",
};

// RPC-Async-V1-09 Async DELETE should return 202.
const AsyncDeleteShouldReturn202: AssertionRule = {
  name: "AsyncDeleteShouldReturn202",
  category: "Management",
  assertion: { 202: {} },
  isAsync: true,
  httpMethods: "delete",
  callType: "stepCall",
};

// RPC-Async-V1-11 Async POST should return 202.
const AsyncPostShouldReturn202: AssertionRule = {
  name: "AsyncPostShouldReturn202",
  category: "Management",
  assertion: { 202: {} },
  isAsync: true,
  httpMethods: "post",
  callType: "stepCall",
};

//RPC-Async-V1-01 Async PUT should return 201/200.
const AsyncPutShouldReturn201: AssertionRule = {
  name: "AsyncPutShouldReturn201",
  category: "Management",
  assertion: { 201: {}, 200: {} },
  isAsync: true,
  httpMethods: "put",
  callType: "stepCall",
};

// RPC-Async-V1-07 Location header must be supported for all async operations that return 202. Azure-AsyncOperation header is optional.
const Async202ResponseShouldIncludeLocationHeader: AssertionRule = {
  name: "Async202ResponseShouldIncludeLocationHeader",
  category: "Management",
  postmanTest: ['if(pm.response.code === 202) { pm.response.to.have.header("Location");}'],
  isAsync: true,
  httpMethods: ["put", "patch", "post", "delete"],
  callType: "stepCall",
};

// RPC-Async-V1-04 provisioningState should be non-terminal state as long as the async operation is in progress.
//TBD

export const postmanArmRules = [
  AsyncPatchShouldReturn202,
  AsyncDeleteShouldReturn202,
  AsyncPostShouldReturn202,
  AsyncPutShouldReturn201,
  Async202ResponseShouldIncludeLocationHeader,
];
