import { getInfo, getRootObjectInfo } from "@ts-common/source-map";

import { ErrorObject } from "ajv";
import { JSONPath } from "jsonpath-plus";
import { xmsMutability, xmsSecret, xmsEnum } from "../util/constants";
import {
  ExtendedErrorCode,
  SourceLocation,
  errorCodeToErrorMetadata,
} from "../util/validationError";
import { LiveValidationIssue } from "../validators/liveValidator";
import { Writable } from "../util/utils";
import { strTemplate } from "../util/strTemplate";
import { Operation, Schema, refSelfSymbol } from "./swaggerTypes";
import { LiveValidationAjvContext } from "./swaggerLiveValidator";
import { getNameFromRef } from "./swaggerLiveValidatorLoader";

const includeErrorsMap: WeakMap<ExtendedErrorCode[], Set<ExtendedErrorCode>> = new WeakMap();

const getIncludeErrorsMap = (includeErrors?: ExtendedErrorCode[]) => {
  if (includeErrors === undefined) {
    return undefined;
  }
  let result = includeErrorsMap.get(includeErrors);
  if (result === undefined) {
    result = new Set(includeErrors);
    includeErrorsMap.set(includeErrors, result);
  }
  return result;
};

export const ajvErrorListToLiveValidationIssueList = (
  errors: ErrorObject[],
  operation: Operation,
  result: LiveValidationIssue[],
  cxt: LiveValidationAjvContext
) => {
  const includeErrorsSet = getIncludeErrorsMap(cxt.includeErrors);

  const similarIssues: Map<string, LiveValidationIssue> = new Map();
  for (const error of errors) {
    const issue = ajvErrorToLiveValidationIssue(error, operation, cxt);
    if (
      issue === undefined ||
      (includeErrorsSet !== undefined && !includeErrorsSet.has(issue.code))
    ) {
      continue;
    }

    const issueHashKey = [
      issue.code,
      issue.message,
      issue.source.url,
      issue.source.position.column.toString(),
      issue.source.position.line.toString(),
    ].join("|");
    const similarIssue = similarIssues.get(issueHashKey);
    if (similarIssue === undefined) {
      similarIssues.set(issueHashKey, issue);
      result.push(issue);
      continue;
    }

    similarIssue.pathsInPayload.push(issue.pathsInPayload[0]);
    similarIssue.jsonPathsInPayload.push(issue.jsonPathsInPayload[0]);
  }

  for (const issue of result) {
    if (issue.jsonPathsInPayload.length > 1) {
      (issue as any).pathsInPayload = [...new Set(issue.pathsInPayload)];
      (issue as any).jsonPathsInPayload = [...new Set(issue.jsonPathsInPayload)];
    }
  }
};

export const ajvErrorToLiveValidationIssue = (
  err: ErrorObject,
  operation: Operation,
  cxt: LiveValidationAjvContext
): LiveValidationIssue | undefined => {
  const { parentSchema, params } = err;
  let { schema } = err;

  if (shouldSkipError(err, cxt)) {
    return undefined;
  }

  let dataPath = err.dataPath;
  const extraDataPath =
    (params as any).additionalProperty ??
    (params as any).missingProperty ??
    (parentSchema as Schema).discriminator;
  if (extraDataPath !== undefined) {
    dataPath = `${dataPath}.${extraDataPath}`;
    if (schema[extraDataPath] !== undefined) {
      schema = schema[extraDataPath];
    }
  }
  if (dataPath.startsWith(".body") && dataPath.length > 5) {
    dataPath = `$${dataPath.substr(5)}`;
  }
  const pathArray: string[] = (JSONPath as any).toPathArray(dataPath);

  const errInfo = ajvErrorCodeToOavErrorCode(err, pathArray, dataPath, cxt);
  if (errInfo === undefined) {
    return undefined;
  }
  const meta = errorCodeToErrorMetadata(errInfo.code);

  let sch: Schema | undefined = parentSchema;
  let info = getInfo(sch);
  if (info === undefined) {
    sch = schema;
    info = getInfo(sch);
  }
  const source: Writable<SourceLocation> =
    info === undefined
      ? {
          url: operation._path._spec._filePath,
          position: { line: -1, column: -1 },
        }
      : {
          url: getRootObjectInfo(info).url,
          position: { line: info.position.line, column: info.position.column },
        };
  if (sch?.[refSelfSymbol] !== undefined) {
    source.jsonRef = sch[refSelfSymbol]!.substr(sch[refSelfSymbol]!.indexOf("#"));
  }

  const result: LiveValidationIssue = {
    code: errInfo.code,
    message: errInfo.message,
    params: errInfo.params,
    pathsInPayload: [(JSONPath as any).toPointer(pathArray).substr(1)],
    jsonPathsInPayload: [dataPath],
    schemaPath: err.schemaPath,
    source,
    severity: meta.severity,
    documentationUrl: meta.docUrl,
    // TODO: documentationUrl: meta.docUrl || undefined,
  };

  return result;
};

const shouldSkipError = (error: ErrorObject, cxt: LiveValidationAjvContext) => {
  const { schema, parentSchema: parentSch, params, keyword, data } = error;
  const parentSchema = parentSch as Schema;

  if (schema?._skipError || parentSchema._skipError) {
    return true;
  }

  // If a response has x-ms-mutability property and its missing the read we can skip this error
  if (
    cxt.isResponse &&
    ((keyword === "required" &&
      parentSchema.properties?.[(params as any).missingProperty]?.[xmsMutability]?.indexOf(
        "read"
      ) === -1) ||
      (keyword === "type" && data === null && parentSchema[xmsMutability]?.indexOf("read") === -1))
  ) {
    return true;
  }

  return false;
};

const errorKeywordsMapping: { [key: string]: ExtendedErrorCode } = {
  additionalProperties: "OBJECT_ADDITIONAL_PROPERTIES",
  required: "OBJECT_MISSING_REQUIRED_PROPERTY",
  format: "INVALID_FORMAT",
  type: "INVALID_TYPE",
  pattern: "PATTERN",
  minimum: "MINIMUM",
  maximum: "MAXIMUM",
  minimumExclusive: "MINIMUM_EXCLUSIVE",
  maximumExclusive: "MAXIMUM_EXCLUSIVE",
  minLength: "MIN_LENGTH",
  maxLength: "MAX_LENGTH",
  maxItems: "ARRAY_LENGTH_LONG",
  minItems: "ARRAY_LENGTH_SHORT",
  maxProperties: "OBJECT_PROPERTIES_MAXIMUM",
  minProperties: "OBJECT_PROPERTIES_MINIMUM",
  uniqueItems: "ARRAY_UNIQUE",
  additionalItems: "ARRAY_ADDITIONAL_ITEMS",
  anyOf: "ANY_OF_MISSING",
  dependencies: "OBJECT_DEPENDENCY_KEY",
  multiple: "MULTIPLE_OF",
  discriminatorMap: "DISCRIMINATOR_VALUE_NOT_FOUND",
};
const errorMessages = {
  INVALID_RESPONSE_CODE: strTemplate`This operation does not have a defined '${"statusCode"}' response code`,
  INVALID_CONTENT_TYPE: strTemplate`Invalid Content-Type (${"contentType"}).  These are supported: ${"supported"}`,
  MISSING_REQUIRED_PARAMETER: strTemplate`Value is required but was not provided`,
  INVALID_RESPONSE_BODY: strTemplate`Body is required in response but not provided`,

  DISCRIMINATOR_VALUE_NOT_FOUND: strTemplate`Discriminator value "${"data"}" not found`,
  ANY_OF_MISSING: strTemplate`Data does not match any schemas from 'anyOf'`,
  ONE_OF_MISSING: strTemplate`Data does not match any schemas from 'oneOf'`,
  ONE_OF_MULTIPLE: strTemplate`Data is valid against more than one schema from 'oneOf'`,
  OBJECT_DEPENDENCY_KEY: strTemplate`Dependency failed - key must exist: ${"missingProperty"} (due to key: ${"property"})`,

  OBJECT_ADDITIONAL_PROPERTIES: strTemplate`Additional properties not allowed: ${"additionalProperty"}`,
  OBJECT_MISSING_REQUIRED_PROPERTY: strTemplate`Missing required property: ${"missingProperty"}`,
  OBJECT_PROPERTIES_MAXIMUM: strTemplate`Too many properties defined (${"count"}), maximum {${"limit"}}`,
  OBJECT_PROPERTIES_MINIMUM: strTemplate`Too few properties defined (${"count"}), minimum {${"limit"}}`,

  ARRAY_LENGTH_LONG: strTemplate`Array is too long (${"data"}), maximum ${"limit"}`,
  ARRAY_LENGTH_SHORT: strTemplate`Array is too short (${"data"}), minimum ${"limit"}`,
  ARRAY_UNIQUE: strTemplate`Array items are not unique (indexes ${"i"} and ${"j"})`,
  ARRAY_ADDITIONAL_ITEMS: strTemplate`Additional items not allowed`,

  INVALID_TYPE: strTemplate`Expected type ${"type"} but found type ${"data"}`,
  INVALID_FORMAT: strTemplate`Object didn't pass validation for format ${"format"}: ${"data"}`,
  PATTERN: strTemplate`String does not match pattern ${"pattern"}: ${"data"}`,
  MULTIPLE_OF: strTemplate`Value ${"data"} is not a multiple of ${"multipleOf"}`,
  ENUM_CASE_MISMATCH: strTemplate`Enum does not match case for: ${"data"}`,
  ENUM_MISMATCH: strTemplate`No enum match for: ${"data"}`,
  MAX_LENGTH: strTemplate`String is too long (${"data"} chars), maximum ${"limit"}`,
  MIN_LENGTH: strTemplate`String is too short (${"data"} chars), minimum ${"limit"}`,
  MINIMUM: strTemplate`Value ${"data"} is less than minimum ${"limit"}`,
  MAXIMUM: strTemplate`Value ${"data"} is greater than maximum ${"limit"}`,
  MINIMUM_EXCLUSIVE: strTemplate`Value ${"data"} is equal or less than exclusive minimum ${"limit"}`,
  MAXIMUM_EXCLUSIVE: strTemplate`Value ${"data"} is equal or greater than exclusive maximum ${"limit"}`,

  READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST: strTemplate`ReadOnly property \`"${"key"}": ${"value"}\`, cannot be sent in the request.`,
  WRITEONLY_PROPERTY_NOT_ALLOWED_IN_RESPONSE: strTemplate`Write-only property \`"${"key"}": ${"value"}\`, is not allowed in the response.`,
  SECRET_PROPERTY: strTemplate`Secret property \`"${"key"}": ${"value"}\`, cannot be sent in the response.`,
};
const getErrMsg = (code: ExtendedErrorCode, param: any): string => {
  const func = (errorMessages as any)[code];
  return func === undefined ? undefined : func(param);
};

// Should be type "never" to ensure we've covered all the errors
export type MissingErrorCode = Exclude<
  ExtendedErrorCode,
  | keyof typeof errorMessages
  | "PII_MISMATCH" // Used in openapi-validate
  | "INTERNAL_ERROR" // Used in liveValidator
  | "UNRESOLVABLE_REFERENCE"
  | "NOT_PASSED" // If keyword mapping not found then we use this error
  | "OPERATION_NOT_FOUND_IN_CACHE_WITH_PROVIDER" // Covered by liveValidator
  | "OPERATION_NOT_FOUND_IN_CACHE_WITH_API"
  | "OPERATION_NOT_FOUND_IN_CACHE_WITH_VERB"
  | "OPERATION_NOT_FOUND_IN_CACHE"
  | "MULTIPLE_OPERATIONS_FOUND"
  | "INVALID_RESPONSE_HEADER"
  | "INVALID_REQUEST_PARAMETER"
>;

const transformParamsKeyword = new Set([
  "pattern",
  "additionalProperties",
  "type",
  "format",
  "multipleOf",
  "required",
]);

const transformReverseParamsKeyword = new Set([
  "minLength",
  "maxLength",
  "maxItems",
  "minItems",
  "maxProperties",
  "minimum",
  "maximum",
  "minimumExclusive",
  "maximumExclusive",
  "discriminatorMap",
]);

interface MetaErr {
  code: ExtendedErrorCode;
  message: string;
  params?: any;
}
export const ajvErrorCodeToOavErrorCode = (
  error: ErrorObject,
  pathArray: string[],
  dataPath: string,
  cxt: LiveValidationAjvContext
): MetaErr | undefined => {
  const { keyword, parentSchema: parentSch } = error;
  const parentSchema = parentSch as Schema | undefined;
  let { params, data } = error;
  let result: MetaErr | undefined = {
    code: "NOT_PASSED",
    message: error.message!,
  };

  switch (keyword) {
    case "enum":
      const { allowedValues } = params as any;
      result =
        data === null && parentSchema?.nullable
          ? undefined
          : isEnumCaseMismatch(data, allowedValues)
          ? errorFromErrorCode("ENUM_CASE_MISMATCH", { data })
          : parentSchema?.[xmsEnum]?.modelAsString
          ? undefined
          : errorFromErrorCode("ENUM_MISMATCH", { data });
      params = [data, allowedValues];
      break;

    case "readOnly":
    case xmsMutability:
    case xmsSecret:
      const param = {
        key: getNameFromRef(parentSchema) ?? pathArray[pathArray.length - 1],
        value: Array.isArray(data) ? data.join(",") : JSON.stringify(data),
      };
      params = [param.key, data];
      result =
        keyword === xmsSecret
          ? errorFromErrorCode("SECRET_PROPERTY", param)
          : cxt.isResponse
          ? errorFromErrorCode("WRITEONLY_PROPERTY_NOT_ALLOWED_IN_RESPONSE", param)
          : errorFromErrorCode("READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST", param);
      break;

    case "oneOf":
      result =
        (params as any).passingSchemas === null
          ? errorFromErrorCode("ONE_OF_MISSING", {})
          : errorFromErrorCode("ONE_OF_MULTIPLE", {});
      params = [];
      break;

    case "type":
      (params as any).type = (params as any).type.replace(",null", "");
      data = schemaType(data);
      break;

    case "discriminatorMap":
      data = (params as any).discriminatorValue;
      break;

    case "maxLength":
    case "minLength":
    case "maxItems":
    case "minItems":
      data = data.length;
      break;

    case "maxProperties":
    case "minProperties":
      data = Object.keys(data).length;
      break;

    case "minimum":
    case "maximum":
    case "minimumExclusive":
    case "maximumExclusive":
      params = { limit: (params as any).limit };
      break;
  }

  const code = errorKeywordsMapping[keyword];
  if (code !== undefined) {
    result = { code, message: getErrMsg(code, { ...params, data }) };
  }

  if (transformParamsKeyword.has(keyword)) {
    params = Object.values(params);
    if (typeof data !== "object") {
      (params as any).push(data);
    }
  } else if (transformReverseParamsKeyword.has(keyword)) {
    params = Object.values(params);
    (params as any[]).unshift(data);
  }

  if (!cxt.isResponse && result !== undefined && dataPath[0] !== "$") {
    // Request parameter error
    if (error.keyword === "required") {
      result = errorFromErrorCode("MISSING_REQUIRED_PARAMETER", {});
    } else {
      // result.code = "INVALID_REQUEST_PARAMETER";
    }
  }

  if (cxt.isResponse && result !== undefined) {
    if (dataPath === ".body") {
      result = errorFromErrorCode("INVALID_RESPONSE_BODY", {});
    } else if (dataPath.startsWith(".header")) {
      result.code = "INVALID_RESPONSE_HEADER";
    }
  }

  if (result !== undefined) {
    result.params = params;
  }
  return result;
};

const errorFromErrorCode = (code: ExtendedErrorCode, param: any) => ({
  code,
  message: (errorMessages as any)[code](param),
});

export const issueFromErrorCode = (code: ExtendedErrorCode, param: any): LiveValidationIssue => {
  const meta = errorCodeToErrorMetadata(code);
  return {
    code,
    severity: meta.severity,
    message: getErrMsg(code, param),
    jsonPathsInPayload: [],
    pathsInPayload: [],
    schemaPath: "",
    source: { url: "", position: { line: -1, column: -1 } },
    documentationUrl: meta.docUrl,
  };
};

const isEnumCaseMismatch = (data: string, enumList: string[]) => {
  if (typeof data !== "string") {
    return false;
  }
  data = data.toLowerCase();
  for (const val of enumList) {
    if (val.toLowerCase() === data) {
      return true;
    }
  }
  return false;
};

const schemaType = (what: any): string => {
  const to = typeof what;

  if (to === "object") {
    if (what === null) {
      return "null";
    }
    if (Array.isArray(what)) {
      return "array";
    }
    return "object"; // typeof what === 'object' && what === Object(what) && !Array.isArray(what);
  }

  if (to === "number") {
    if (Number.isFinite(what)) {
      if (what % 1 === 0) {
        return "integer";
      } else {
        return "number";
      }
    }
    if (Number.isNaN(what)) {
      return "not-a-number";
    }
    return "unknown-number";
  }
  return to; // undefined, boolean, string, function
};
