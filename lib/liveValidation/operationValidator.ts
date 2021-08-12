import { ParsedUrlQuery } from "querystring";
import { getInfo, MutableStringMap, StringMap } from "@azure-tools/openapi-tools-common";
import { LowerHttpMethods, Operation, Response, TransformFn } from "../swagger/swaggerTypes";
import { sourceMapInfoToSourceLocation } from "../swaggerValidator/ajvSchemaValidator";
import { SchemaValidateContext, SchemaValidateIssue } from "../swaggerValidator/schemaValidator";
import { jsonPathToPointer } from "../util/jsonUtils";
import { Writable } from "../util/utils";
import { SourceLocation } from "../util/validationError";
import { extractPathParamValue } from "../transform/pathRegexTransformer";
import { getOavErrorMeta, TrafficValidationErrorCode } from "../util/errorDefinitions";
import {
  LiveValidationIssue,
  LiveValidatorLoggingLevels,
  LiveValidatorLoggingTypes,
} from "./liveValidator";
import { LiveValidatorLoader } from "./liveValidatorLoader";
import { OperationMatch } from "./operationSearcher";

export interface ValidationRequest {
  providerNamespace: string;
  resourceType: string;
  apiVersion: string;
  requestMethod: LowerHttpMethods;
  host: string;
  pathStr: string;
  query?: ParsedUrlQuery;
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

export const validateSwaggerLiveRequest = async (
  request: LiveRequest,
  info: OperationContext,
  loader?: LiveValidatorLoader,
  includeErrors?: TrafficValidationErrorCode[],
  logging?: (
    message: string,
    level?: LiveValidatorLoggingLevels,
    loggingType?: LiveValidatorLoggingTypes,
    operationName?: string,
    durationInMilliseconds?: number,
    validationRequest?: ValidationRequest
  ) => void
) => {
  const { operation } = info.operationMatch!;
  const { body, query } = request;
  const result: LiveValidationIssue[] = [];

  let validate = operation._validate;
  if (validate === undefined) {
    if (loader === undefined) {
      throw new Error("Loader is undefined but request validator isn't built yet");
    }
    const startTimeToBuild = Date.now();
    validate = await loader.getRequestValidator(operation);
    const elapsedTime = Date.now() - startTimeToBuild;
    if (logging) {
      logging(
        `On-demand build request validator with DurationInMs:${elapsedTime}`,
        LiveValidatorLoggingLevels.debug,
        LiveValidatorLoggingTypes.trace,
        "Oav.OperationValidator.validateSwaggerLiveRequest.loader.getRequestValidator",
        undefined,
        info.validationRequest
      );
      logging(
        `On-demand build request validator`,
        LiveValidatorLoggingLevels.info,
        LiveValidatorLoggingTypes.perfTrace,
        "Oav.OperationValidator.validateSwaggerLiveRequest.loader.getRequestValidator",
        elapsedTime,
        info.validationRequest
      );
    }
  }

  const pathParam = extractPathParamValue(info.operationMatch!);
  transformMapValue(query, operation._queryTransform);
  const headers = transformLiveHeader(request.headers ?? {}, operation);
  validateContentType(operation.consumes!, headers, true, result);

  const ctx = { isResponse: false, includeErrors };
  const errors = validate(ctx, {
    path: pathParam,
    body: transformBodyValue(body, operation),
    headers,
    query,
  });
  schemaValidateIssueToLiveValidationIssue(errors, operation, ctx, result);

  return result;
};

export const validateSwaggerLiveResponse = async (
  response: LiveResponse,
  info: OperationContext,
  loader?: LiveValidatorLoader,
  includeErrors?: TrafficValidationErrorCode[],
  isArmCall?: boolean,
  logging?: (
    message: string,
    level?: LiveValidatorLoggingLevels,
    loggingType?: LiveValidatorLoggingTypes,
    operationName?: string,
    durationInMilliseconds?: number,
    validationRequest?: ValidationRequest
  ) => void
) => {
  const { operation } = info.operationMatch!;
  const { statusCode, body } = response;
  const rspDef = operation.responses;
  const result: LiveValidationIssue[] = [];

  let rsp = rspDef[statusCode];
  const realCode = parseInt(statusCode, 10);
  if (rsp === undefined && 400 <= realCode && realCode <= 599) {
    rsp = rspDef.default;
  }
  if (rsp === undefined) {
    result.push(issueFromErrorCode("INVALID_RESPONSE_CODE", { statusCode }, rspDef));
    return result;
  }

  let validate = rsp._validate;
  if (validate === undefined) {
    if (loader === undefined) {
      throw new Error("Loader is undefined but request validator isn't built yet");
    }
    const startTimeToBuild = Date.now();
    validate = await loader.getResponseValidator(rsp);
    const elapsedTime = Date.now() - startTimeToBuild;
    if (logging) {
      logging(
        `On-demand build response validator with DurationInMs:${elapsedTime}`,
        LiveValidatorLoggingLevels.debug,
        LiveValidatorLoggingTypes.trace,
        "Oav.OperationValidator.validateSwaggerLiveResponse.loader.getResponseValidator",
        undefined,
        info.validationRequest
      );
      logging(
        `On-demand build request validator`,
        LiveValidatorLoggingLevels.info,
        LiveValidatorLoggingTypes.perfTrace,
        "Oav.OperationValidator.validateSwaggerLiveResponse.loader.getResponseValidator",
        elapsedTime,
        info.validationRequest
      );
    }
  }

  const headers = transformLiveHeader(response.headers ?? {}, rsp);
  if (rsp.schema !== undefined) {
    validateContentType(operation.produces!, headers, false, result);
    if (isArmCall && realCode >= 200 && realCode < 300) {
      validateLroOperation(operation, statusCode, headers, body, result);
    }
  }

  const ctx = {
    isResponse: true,
    includeErrors,
    statusCode,
    httpMethod: operation._method,
  };
  const errors = validate(ctx, {
    headers,
    body,
  });
  schemaValidateIssueToLiveValidationIssue(errors, operation, ctx, result);

  return result;
};

const transformBodyValue = (body: any, operation: Operation): any => {
  return operation._bodyTransform === undefined ? body : operation._bodyTransform(body);
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

const validateContentType = (
  allowedContentTypes: string[],
  headers: StringMap<string>,
  isRequest: boolean,
  result: LiveValidationIssue[]
) => {
  const contentType =
    headers["content-type"]?.split(";")[0] || (isRequest ? undefined : "application/octet-stream");
  if (contentType !== undefined && !allowedContentTypes.includes(contentType)) {
    result.push(
      issueFromErrorCode("INVALID_CONTENT_TYPE", {
        contentType,
        supported: allowedContentTypes.join(", "),
      })
    );
  }
};

const schemaValidateIssueToLiveValidationIssue = (
  input: SchemaValidateIssue[],
  operation: Operation,
  ctx: SchemaValidateContext,
  output: LiveValidationIssue[]
) => {
  for (const i of input) {
    const issue = i as Writable<LiveValidationIssue>;

    issue.documentationUrl = "";

    const source = issue.source as Writable<SourceLocation>;
    if (!source.url) {
      source.url = operation._path._spec._filePath;
    }

    let skipIssue = false;
    issue.pathsInPayload = issue.jsonPathsInPayload.map((path, idx) => {
      const isMissingRequiredProperty = issue.code === "OBJECT_MISSING_REQUIRED_PROPERTY";
      const isBodyIssue = path.startsWith(".body");

      if (issue.code === "MISSING_RESOURCE_ID") {
        // ignore this error for sub level resources
        if (path.includes("properties")) {
          skipIssue = true;
          return "";
        }
      }

      if (isBodyIssue && (path.length > 5 || !isMissingRequiredProperty)) {
        path = "$" + path.substr(5);
        issue.jsonPathsInPayload[idx] = path;
        return jsonPathToPointer(path);
      }

      if (isMissingRequiredProperty) {
        if (ctx.isResponse) {
          if (isBodyIssue) {
            issue.code = "INVALID_RESPONSE_BODY";
            // If a long running operation with code 201 or 202 then it could has empty body
            if (
              operation["x-ms-long-running-operation"] &&
              (ctx.statusCode === "201" || ctx.statusCode === "202")
            ) {
              skipIssue = true;
            }
          } else if (path.startsWith(".headers")) {
            issue.code = "INVALID_RESPONSE_HEADER";
          }
        } else {
          // In request
          issue.code = "MISSING_REQUIRED_PARAMETER";
        }

        const meta = getOavErrorMeta(issue.code, { missingProperty: issue.params[0] });
        issue.severity = meta.severity;
        issue.message = meta.message;
      }

      return jsonPathToPointer(path);
    });

    if (!skipIssue) {
      output.push(issue);
    }
  }
};

const validateLroOperation = (
  operation: Operation,
  statusCode: string,
  headers: StringMap<string>,
  body: any,
  result: LiveValidationIssue[]
) => {
  if (operation["x-ms-long-running-operation"] === true) {
    if (operation._method === "post") {
      if (statusCode === "202" || statusCode === "201") {
        validateLroHeader(operation, statusCode, headers, body, result);
      } else if (statusCode !== "200" && statusCode !== "204") {
        result.push(issueFromErrorCode("LRO_RESPONSE_CODE", { statusCode }, operation.responses));
      }
    } else if (operation._method === "patch") {
      if (statusCode === "202" || statusCode === "201") {
        validateLroHeader(operation, statusCode, headers, body, result);
      } else if (statusCode !== "200") {
        result.push(issueFromErrorCode("LRO_RESPONSE_CODE", { statusCode }, operation.responses));
      }
    } else if (operation._method === "delete") {
      if (statusCode === "202") {
        validateLroHeader(operation, statusCode, headers, body, result);
      } else if (statusCode !== "200" && statusCode !== "204") {
        result.push(issueFromErrorCode("LRO_RESPONSE_CODE", { statusCode }, operation.responses));
      }
    } else if (operation._method === "put") {
      if (statusCode === "202" || statusCode === "201") {
        validateLroHeader(operation, statusCode, headers, body, result);
      } else if (statusCode !== "200") {
        result.push(issueFromErrorCode("LRO_RESPONSE_CODE", { statusCode }, operation.responses));
      }
    }
  }
};

const validateLroHeader = (
  operation: Operation,
  statusCode: string,
  headers: StringMap<string>,
  body: any,
  result: LiveValidationIssue[]
) => {
  if (statusCode === "201" && body?.properties !== undefined) {
    const properties = body.properties;
    if (
      properties &&
      (properties.provisioningState === undefined ||
        properties.provisioningState === "Succeeded" ||
        properties.provisioningState === "Failed" ||
        properties.provisioningState === "Canceled")
    ) {
      // Ignore LRO header check when it's sync call
      return;
    }
  }

  if (
    (headers.location === undefined || headers.location === "") &&
    (headers["azure-AsyncOperation"] === undefined || headers["azure-AsyncOperation"] === "") &&
    (headers["azure-asyncoperation"] === undefined || headers["azure-asyncoperation"] === "")
  ) {
    result.push(
      issueFromErrorCode(
        "LRO_RESPONSE_HEADER",
        {
          header: "location or azure-AsyncOperation",
        },
        operation.responses
      )
    );
  }
};

export const issueFromErrorCode = (
  code: TrafficValidationErrorCode,
  param: any,
  relatedSchema?: {}
): LiveValidationIssue => {
  const meta = getOavErrorMeta(code, param);
  return {
    code,
    severity: meta.severity,
    message: meta.message,
    jsonPathsInPayload: [],
    pathsInPayload: [],
    schemaPath: "",
    source: sourceMapInfoToSourceLocation(getInfo(relatedSchema)),
    documentationUrl: "",
  };
};
