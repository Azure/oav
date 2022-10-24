import { ItemDefinition, Request, Response, DescriptionDefinition } from "postman-collection";
import {
  ItemMetadata,
  NewmanAssertion,
  NewmanExecution,
  NewmanReport,
  NewmanRequest,
  NewmanResponse,
} from "./apiScenarioTypes";

export interface RawNewmanSummary {
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

export function parseNewmanSummary(rawReport: RawNewmanSummary): NewmanReport {
  const ret: NewmanReport = { variables: {}, executions: [], timings: {} };
  for (const it of rawReport.run.executions) {
    ret.executions.push(parseNewmanExecution(it));
  }
  ret.timings = rawReport.run.timings;
  ret.variables = parseVariables(rawReport.environment.values.members);
  return ret;
}

function parseNewmanExecution(it: RawNewmanExecution): NewmanExecution {
  return {
    id: it.id,
    request: parseRequest(it.request),
    response: parseResponse(it.response ?? new Response(undefined as any)),
    annotation: it.item.description
      ? (JSON.parse((it.item.description as DescriptionDefinition).content) as ItemMetadata)
      : undefined,
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
