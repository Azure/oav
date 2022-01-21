import { Ajv, CompilationContext } from "ajv";
import { JsonLoader } from "../swagger/jsonLoader";
import { Schema } from "../swagger/swaggerTypes";
import { xmsAzureResource, xmsMutability, xmsSecret } from "../util/constants";
import { ajvEnableDiscriminatorMap } from "./ajvDiscriminatorMap";

export const ajvEnableReadOnlyAndXmsMutability = (ajv: Ajv) => {
  ajv.removeKeyword("readOnly");
  ajv.addKeyword("readOnly", {
    metaSchema: { type: "boolean" },
    inline: (
      it: CompilationContext,
      _keyword: string,
      isReadOnly: boolean,
      parentSchema: Schema
    ) => {
      if (parentSchema?.[xmsMutability] !== undefined) {
        return "1";
      }
      const data = `data${it.dataLevel || ""}`;
      return isReadOnly ? `this.isResponse || ${data} === null || ${data} === undefined` : "1";
    },
  });

  ajv.addKeyword(xmsMutability, {
    metaSchema: { type: "array", items: { enum: ["create", "update", "read"] } } as Schema,
    inline: (
      it: CompilationContext,
      _keyword: string,
      mutability: Exclude<Schema[typeof xmsMutability], undefined>
    ) => {
      const validInRequest = mutability.includes("create") || mutability.includes("update");
      const validInResponse = mutability.includes("read");
      if (validInRequest && validInResponse) {
        return "1";
      }
      if (!validInRequest && !validInResponse) {
        throw new Error(`Invalid ${xmsMutability} value: ${JSON.stringify(mutability)}`);
      }
      const data = `data${it.dataLevel || ""}`;
      return `${
        validInRequest ? "!" : ""
      }this.isResponse || ${data} === null || ${data} === undefined`;
    },
  });
};

export const ajvEnableXmsSecret = (ajv: Ajv) => {
  ajv.addKeyword(xmsSecret, {
    metaSchema: { type: "boolean" } as Schema,
    inline: (it: CompilationContext, _keyword: string, isSecret: boolean) => {
      const data = `data${it.dataLevel || ""}`;
      return isSecret ? `!this.isResponse || ${data} === null || ${data} === undefined` : "1";
    },
  });
};

export const ajvEnableXmsAzureResource = (ajv: Ajv) => {
  ajv.addKeyword(xmsAzureResource, {
    metaSchema: { type: "boolean" } as Schema,
    inline: (it: CompilationContext, _keyword: string, isResource: boolean) => {
      const data = `data${it.dataLevel || ""}`;
      return isResource
        ? `!(this.isResponse && (this.httpMethod === 'get' || this.httpMethod === 'put')) || (${data}.id !== null && ${data}.id !== undefined)`
        : "1";
    },
  });
};

export const ajvEnableInt32AndInt64Format = (ajv: Ajv) => {
  ajv.addFormat("int32", {
    type: "number",
    validate: (x) => x % 1 === 0 && x >= -2_147_483_648 && x <= 2_147_483_647,
  });

  // TODO int64 range exceed Number.MAX_SAFE_INTEGER so we will lost precision when JSON.parse
  const int64Max = BigInt(2) ** BigInt(63) - BigInt(1);
  const int64Min = BigInt(2) ** BigInt(63) * BigInt(-1);
  ajv.addFormat("int64", {
    type: "number",
    validate: (x) => x % 1 === 0 && x >= int64Min && x <= int64Max,
  });
};

export const ajvEnableUnixTimeFormat = (ajv: Ajv) => {
  ajv.addFormat("unixtime", {
    type: "number",
    validate: (x) => x % 1 === 0,
  });
};

export const ajvAddFormatsDefaultValidation = (
  ajv: Ajv,
  type: "string" | "number",
  formats: string[]
) => {
  for (const format of formats) {
    ajv.addFormat(format, {
      type,
      validate: () => true,
    });
  }
};

export const ajvEnableDateTimeRfc1123Format = (ajv: Ajv) => {
  // https://tools.ietf.org/html/rfc822#section-5
  ajv.addFormat("date-time-rfc1123", {
    type: "string",
    validate:
      /^((Mon|Tue|Wed|Thu|Fri|Sat|Sun), )((((([0-2]\d|3[01]) (Jan|Mar|May|Jul|Aug|Oct|Dec))|(([0-2]\d|30) (Apr|Jun|Sep|Nov))|(([01]\d|2[0-8]) Feb)) \d{4})|(29 Feb ((([0-9]{2})(0[48]|[2468][048]|[13579][26]))|((0[48]|[2468][048]|[3579][26])00)))) ([01]\d|2[0-3]):[0-5][0-9]:[0-5][0-9] GMT$/,
  });
};

export const ajvEnableDurationFormat = (ajv: Ajv) => {
  // https://en.wikipedia.org/wiki/ISO_8601#Durations
  ajv.addFormat("duration", {
    type: "string",
    validate:
      /^P([0-9]+(?:[,\.][0-9]+)?Y)?([0-9]+(?:[,\.][0-9]+)?M)?([0-9]+(?:[,\.][0-9]+)?D)?(?:T([0-9]+(?:[,\.][0-9]+)?H)?([0-9]+(?:[,\.][0-9]+)?M)?([0-9]+(?:[,\.][0-9]+)?S)?)?$/,
  });
};

// for (const keyword of [
//   "name",
//   "in",
//   "example",
//   "parameters",
//   "externalDocs",
//   "x-nullable",
//   "x-ms-enum",
//   "x-ms-azure-resource",
//   "x-ms-parameter-location",
//   "x-ms-client-name",
//   "x-ms-external",
//   "x-ms-skip-url-encoding",
//   "x-ms-client-flatten",
//   "x-ms-api-version",
//   "x-ms-parameter-grouping",
//   "x-ms-discriminator-value",
//   "x-ms-client-request-id",
//   "x-apim-code-nillable",
//   "x-new-pattern",
//   "x-previous-pattern",
//   "x-comment",
//   "x-abstract",
//   "allowEmptyValue",
//   "collectionFormat",
// ]) {
//   ajv.addKeyword(keyword, {});
// }

export const ajvEnableAll = (ajv: Ajv, jsonLoader: JsonLoader) => {
  ajvEnableDiscriminatorMap(ajv, jsonLoader);
  ajvEnableXmsSecret(ajv);
  ajvEnableReadOnlyAndXmsMutability(ajv);
  ajvEnableUnixTimeFormat(ajv);
  ajvEnableInt32AndInt64Format(ajv);
  ajvEnableDurationFormat(ajv);
  ajvEnableDateTimeRfc1123Format(ajv);
  ajvAddFormatsDefaultValidation(ajv, "string", [
    "byte",
    "password",
    "file",
    "base64url",
    "",
    "binary",
    "non-iso-duration",
    "char",
  ]);
  ajvAddFormatsDefaultValidation(ajv, "number", ["double", "float", "decimal"]);
};

export const ajvEnableArmRule = (ajv: Ajv) => {
  ajvEnableXmsAzureResource(ajv);
};
