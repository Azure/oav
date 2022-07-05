import {
  RequestDefinition,
  ResponseDefinition,
  ItemDefinition,
  Request,
  Response,
  DescriptionDefinition,
} from "postman-collection";
import { RawExecution, RawReport, RawRequest, RawResponse } from "./apiScenarioTypes";

export interface NewmanReport {
  run: Run;
  environment: any;
  collection: any;
}

interface Run {
  executions: NewmanExecution[];
  timings: { started: number; completed: number; responseAverage: number };
}

interface NewmanExecution {
  item: ItemDefinition;
  request: RequestDefinition;
  response: ResponseDefinition;
}

export function parseNewmanReport(newmanReport: NewmanReport): RawReport {
  const ret: RawReport = { variables: {}, executions: [], timings: {}, metadata: {} };
  ret.metadata = JSON.parse(newmanReport.collection.info.description.content);
  for (const it of newmanReport.run.executions) {
    ret.executions.push(generateExampleItem(it));
  }
  ret.timings = newmanReport.run.timings;
  ret.variables = parseVariables(newmanReport.environment.values);
  return ret;
}

function generateExampleItem(it: NewmanExecution): RawExecution {
  const resp = new Response(it.response);
  const req = new Request(it.request);
  const rawReq = parseRequest(req);
  const rawResp = parseResponse(resp);
  const annotation = JSON.parse((it.item.description as DescriptionDefinition)?.content || "{}");
  return {
    request: rawReq,
    response: rawResp,
    annotation: annotation,
  };
}

function parseRequest(req: Request): RawRequest {
  const ret: RawRequest = {
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

function parseResponse(resp: Response): RawResponse {
  const ret: RawResponse = {
    headers: [],
    statusCode: resp.code,
    body: "",
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
