import { ParsedUrlQuery } from "querystring";
import { StringMap, MutableStringMap } from "@ts-common/string-map";

import { RegExpWithKeys } from "../util/path";
import { ExtendedErrorCode } from "../util/validationError";
import { LiveValidationIssue } from "../validators/liveValidator";
import { Operation, Response, TransformFn } from "./swaggerTypes";
import {
  ajvErrorListToLiveValidationIssueList,
  issueFromErrorCode,
} from "./swaggerLiveValidatorErrors";
import { SwaggerLiveValidatorLoader } from "./swaggerLiveValidatorLoader";

export interface OperationMatch {
  operation: Operation;
  pathRegex: RegExpWithKeys;
  pathMatch: RegExpExecArray;
}

export interface ValidationRequest {
  providerNamespace: string;
  resourceType: string;
  apiVersion: string;
  requestMethod: string;
  pathStr: string;
  queryStr?: ParsedUrlQuery;
  correlationId?: string;
  requestUrl: string;
}

export interface OperationContext {
  operationId: string;
  apiVersion: string;
  operationMatch?: OperationMatch;
  validationRequest?: ValidationRequest;
}

export interface LiveRequest {
  query?: ParsedUrlQuery;
  readonly url: string;
  readonly method: string;
  headers?: { [propertyName: string]: string };
  body?: StringMap<unknown>;
}

export interface LiveResponse {
  statusCode: string;
  headers?: { [propertyName: string]: string };
  body?: StringMap<unknown>;
}

export interface LiveValidationAjvContext {
  isResponse: boolean;
  includeErrors?: ExtendedErrorCode[];
}

export const validateSwaggerLiveRequest = async (
  request: LiveRequest,
  info: OperationContext,
  loader?: SwaggerLiveValidatorLoader,
  includeErrors?: ExtendedErrorCode[]
) => {
  const { pathRegex, pathMatch, operation } = info.operationMatch!;
  const result: LiveValidationIssue[] = [];

  let validate = operation._validate;
  if (validate === undefined) {
    if (loader === undefined) {
      throw new Error("Loader is undefined but request validator isn't built yet");
    }
    validate = await loader.getRequestValidator(operation);
  }

  // extract path params
  const pathParam: MutableStringMap<string> = {};
  const _keys = pathRegex._keys;
  for (let idx = 1; idx < pathMatch.length; ++idx) {
    if (_keys[idx] !== undefined) {
      pathParam[_keys[idx]] = decodeURIComponent(pathMatch[idx]);
    }
  }

  transformMapValue(request.query, operation._queryTransform);

  const toValidate = {
    path: pathParam,
    body: processPayload(request.body),
    headers: transformLiveHeader(request.headers ?? {}, operation),
    query: request.query,
  };
  const cxt: LiveValidationAjvContext = { isResponse: false, includeErrors };
  if (!validate.call(cxt, toValidate)) {
    ajvErrorListToLiveValidationIssueList(validate.errors!, operation, result, cxt);
    validate.errors = null;
  }

  return result;
};

export const validateSwaggerLiveResponse = async (
  response: LiveResponse,
  info: OperationContext,
  loader?: SwaggerLiveValidatorLoader,
  includeErrors?: ExtendedErrorCode[]
) => {
  const { operation } = info.operationMatch!;
  const { statusCode, headers, body } = response;
  const rspDef = operation.responses;
  const result: LiveValidationIssue[] = [];

  let rsp = rspDef[statusCode];
  const realCode = parseInt(statusCode, 10);
  if (rsp === undefined && 400 <= realCode && realCode <= 599) {
    rsp = rspDef.default;
  }
  if (rsp === undefined) {
    result.push(issueFromErrorCode("INVALID_RESPONSE_CODE", { statusCode }));
    return result;
  }

  let validate = rsp._validate;
  if (validate === undefined) {
    if (loader === undefined) {
      throw new Error("Loader is undefined but request validator isn't built yet");
    }
    validate = await loader.getResponseValidator(rsp);
  }

  const h = transformLiveHeader(headers ?? {}, rsp);
  if (rsp.schema !== undefined) {
    const contentType = h["content-type"]?.split(";")[0] || "application/octet-stream";
    if (!operation.produces!.includes(contentType)) {
      result.push(
        issueFromErrorCode("INVALID_CONTENT_TYPE", {
          contentType,
          supported: operation.produces?.join(", "),
        })
      );
    }
  }

  const toValidate = {
    headers: h,
    body: processPayload(body),
  };
  const cxt: LiveValidationAjvContext = { isResponse: true, includeErrors };
  if (!validate.call(cxt, toValidate)) {
    ajvErrorListToLiveValidationIssueList(validate.errors!, operation, result, cxt);
    validate.errors = null;
  }

  return result;
};

const transformLiveHeader = (
  headers: StringMap<string>,
  it: Operation | Response
): StringMap<string> => {
  const result: MutableStringMap<string> = {};
  for (const headerName of Object.keys(headers)) {
    result[headerName.toLowerCase()] = headers[headerName];
  }
  transformMapValue(result, it._headerTransform);
  return result;
};

const transformMapValue = (
  data?: MutableStringMap<string | number | boolean | Array<string | number | boolean>>,
  transforms?: StringMap<TransformFn>
) => {
  if (transforms === undefined || data === undefined) {
    return;
  }
  for (const key of Object.keys(transforms)) {
    const transform = transforms[key]!;
    const val = data[key];
    if (typeof val === "string") {
      data[key] = transform(val);
    } else if (Array.isArray(val)) {
      data[key] = val.map(transform as any);
    }
  }
};

const processPayload = (payload: any) => {
  return payload;
};
