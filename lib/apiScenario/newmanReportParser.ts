import { ItemDefinition, Request, Response, DescriptionDefinition } from "postman-collection";
import {
  NewmanAssertion,
  NewmanExecution,
  NewmanReport,
  NewmanRequest,
  NewmanResponse,
} from "./apiScenarioTypes";

export interface RawNewmanReport {
  run: Run;
  environment: any;
  collection: any;
}

interface Run {
  executions: RawNewmanExecution[];
  timings: { started: number; completed: number; responseAverage: number };
}

interface Assertion {
  error?: NewmanAssertion;
}

interface RawNewmanExecution {
  id: string;
  item: ItemDefinition;
  request: Request;
  response: Response;
  assertions?: Assertion[];
}

export function parseNewmanReport(newmanReport: RawNewmanReport): NewmanReport {
  const ret: NewmanReport = { variables: {}, executions: [], timings: {} };
  for (const it of newmanReport.run.executions) {
    ret.executions.push(generateExampleItem(it));
  }
  ret.timings = newmanReport.run.timings;
  ret.variables = parseVariables(newmanReport.environment.values);
  return ret;
}

function generateExampleItem(it: RawNewmanExecution): NewmanExecution {
  const resp = it.response ? it.response : new Response(undefined as any);
  const req = it.request;
  const rawReq = parseRequest(req);
  const rawResp = parseResponse(resp);
  const annotation = JSON.parse((it.item.description as DescriptionDefinition)?.content || "{}");
  return {
    id: it.id,
    request: rawReq,
    response: rawResp,
    annotation: annotation,
    assertions: it.assertions?.map((it) => it.error!).filter((it) => it !== undefined) || [],
  };
}

function parseRequest(req: Request): NewmanRequest {
  const ret: NewmanRequest = {
    url: "",
    method: "",
    headers: [],
    body: "",
  };
  ret.url = req.url.toString();
  ret.headers = parseHeader(req.headers.toJSON());
  ret.method = req.method;
  ret.body = req.body?.toString() || "";
  return ret;
}

function parseResponse(resp: Response): NewmanResponse {
  const ret: NewmanResponse = {
    headers: [],
    statusCode: resp.code,
    body: "",
    responseTime: resp.responseTime,
  };
  ret.headers = parseHeader(resp.headers.toJSON());

  ret.body = resp.stream?.toString() || "";
  return ret;
}

function parseHeader(headers: any[]) {
  const ret: any = {};
  for (const it of headers) {
    ret[it.key] = it.value;

    // Currently only mask bearer token header.
    // For further sensitive data, should add mask module here
    if (it.key === "Authorization") {
      ret[it.key] = "<bearer token>";
    }
  }
  return ret;
}

function parseVariables(environment: any[]) {
  const ret: any = {};
  for (const it of environment) {
    if (it.type === "string" || it.type === "any") {
      ret[it.key] = { type: "string", value: it.value };
    }
  }
  return ret;
}
