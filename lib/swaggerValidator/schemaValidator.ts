import { Schema } from "../swagger/swaggerTypes.js";
import { SchemaValidationErrorCode, TrafficValidationErrorCode } from "../util/errorDefinitions.js";
import { Severity } from "../util/severity.js";
import { SourceLocation } from "../util/validationError.js";

export interface SchemaValidateContext {
  isResponse?: boolean;
  includeErrors?: TrafficValidationErrorCode[];
  statusCode?: string;
}

export interface SchemaValidateIssue {
  code: SchemaValidationErrorCode;
  severity: Severity;
  message: string;
  jsonPathsInPayload: string[];
  schemaPath: string;
  source: SourceLocation;
  params?: any;
}

export type SchemaValidateFunction = (
  ctx: SchemaValidateContext,
  data: any
) => SchemaValidateIssue[];

export interface SchemaValidator {
  compile(schema: Schema): SchemaValidateFunction;
  compileAsync(schema: Schema): Promise<SchemaValidateFunction>;
}

export interface SchemaValidatorOption {
  isArmCall?: boolean;
}

const includeErrorsMap: WeakMap<string[], Set<string>> = new WeakMap();

export const getIncludeErrorsMap = (includeErrors?: string[]) => {
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
