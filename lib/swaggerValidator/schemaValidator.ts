import { JsonLoader } from "../swagger/jsonLoader";
import { Schema } from "../swagger/swaggerTypes";
import { strTemplate } from "../util/strTemplate";
import { ExtendedErrorCode, SourceLocation } from "../util/validationError";

export interface SchemaValidateContext {
  isResponse?: boolean;
  includeErrors?: ExtendedErrorCode[];
  statusCode?: string;
  jsonLoader?: JsonLoader;
}

export interface SchemaValidateIssue {
  code: ExtendedErrorCode;
  readonly message: string;
  readonly jsonPathsInPayload: string[];
  readonly schemaPath: string;
  readonly source: SourceLocation;
  readonly params?: any;
}

export type SchemaValidateFunction = (
  ctx: SchemaValidateContext,
  data: any
) => SchemaValidateIssue[];

export interface SchemaValidator {
  compile(schema: Schema): SchemaValidateFunction;
  compileAsync(schema: Schema): Promise<SchemaValidateFunction>;
  dispose(): Promise<void>;
}

export interface SchemaValidatorOption {
  isArmCall?: boolean;
}

const includeErrorsMap: WeakMap<ExtendedErrorCode[], Set<ExtendedErrorCode>> = new WeakMap();

export const getIncludeErrorsMap = (includeErrors?: ExtendedErrorCode[]) => {
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

export const validateErrorMessages: { [key in ExtendedErrorCode]?: (params: any) => string } = {
  INVALID_RESPONSE_CODE: strTemplate`This operation does not have a defined '${"statusCode"}' response code`,
  INVALID_CONTENT_TYPE: strTemplate`Invalid Content-Type (${"contentType"}).  These are supported: ${"supported"}`,
  MISSING_REQUIRED_PARAMETER: strTemplate`Value is required but was not provided`,
  INVALID_RESPONSE_BODY: strTemplate`Body is required in response but not provided`,
  INVALID_RESPONSE_HEADER: strTemplate`Header ${"missingProperty"} is required in response but not provided`,
  MISSING_RESOURCE_ID: strTemplate`id is required to return in response of GET/PUT resource calls but not being provided`,
  LRO_RESPONSE_CODE: strTemplate`Respond to the initial request of a long running operation, Patch/Post call must return 201 or 202, Delete call must return 202 or 204, Put call must return 202 or 201 or 200, but ${"statusCode"} being returned`,
  LRO_RESPONSE_HEADER: strTemplate`Long running operation should return ${"header"} in header but not provided`,

  DISCRIMINATOR_VALUE_NOT_FOUND: strTemplate`Discriminator value "${"data"}" not found`,
  ANY_OF_MISSING: strTemplate`Data does not match any schemas from 'anyOf'`,
  ONE_OF_MISSING: strTemplate`Data does not match any schemas from 'oneOf'`,
  ONE_OF_MULTIPLE: strTemplate`Data is valid against more than one schema from 'oneOf'`,
  OBJECT_DEPENDENCY_KEY: strTemplate`Dependency failed - key must exist: ${"missingProperty"} (due to key: ${"property"})`,

  OBJECT_ADDITIONAL_PROPERTIES: strTemplate`Additional properties not allowed: ${"additionalProperty"}`,
  OBJECT_MISSING_REQUIRED_PROPERTY: strTemplate`Missing required property: ${"missingProperty"}`,
  OBJECT_PROPERTIES_MAXIMUM: strTemplate`Too many properties defined (${"data"}), maximum ${"limit"}`,
  OBJECT_PROPERTIES_MINIMUM: strTemplate`Too few properties defined (${"data"}), minimum ${"limit"}`,

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

  READONLY_PROPERTY_NOT_ALLOWED_IN_REQUEST: strTemplate`ReadOnly property "${"key"}" cannot be sent in the request`,
  WRITEONLY_PROPERTY_NOT_ALLOWED_IN_RESPONSE: strTemplate`Write-only property "${"key"}" is not allowed in the response`,
  SECRET_PROPERTY: strTemplate`Secret property "${"key"}" cannot be sent in the response`,
};

export const getValidateErrorMessage = (code: ExtendedErrorCode, param: any): string => {
  const func = (validateErrorMessages as any)[code];
  return func === undefined ? undefined : func(param);
};
