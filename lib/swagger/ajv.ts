import { default as ajvInit, CompilationContext } from "ajv";
import { xmsMutability, xmsSecret } from "../util/constants";
import { FileSystemJsonLoader, $id } from "./fileSystemJsonLoader";
import { Schema, SwaggerSpec } from "./swaggerTypes";
import { addAjvDiscriminatorMapKeyword } from "./ajvDiscriminatorMap";

export const initLiveValidatorAjv = (loader: FileSystemJsonLoader) => {
  const ajv = ajvInit({
    // tslint:disable-next-line: no-submodule-imports
    meta: require("ajv/lib/refs/json-schema-draft-04.json"),
    schemaId: "auto",
    extendRefs: "fail",
    format: "full",
    missingRefs: true,
    addUsedSchema: false,
    removeAdditional: false,
    nullable: true,
    allErrors: true,
    messages: true,
    verbose: true,
    inlineRefs: false,
    passContext: true,
    loopRequired: 2,
    loadSchema: async (uri) => {
      const spec: SwaggerSpec = await loader.resolveFile(uri);
      return { [$id]: spec[$id], definitions: spec.definitions, parameters: spec.parameters };
    },
  });
  addAjvDiscriminatorMapKeyword(ajv, loader);

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

  ajv.addKeyword(xmsSecret, {
    metaSchema: { type: "boolean" } as Schema,
    inline: (it: CompilationContext, _keyword: string, isSecret: boolean) => {
      const data = `data${it.dataLevel || ""}`;
      return isSecret ? `!this.isResponse || ${data} === null || ${data} === undefined` : "1";
    },
  });

  ajv.addFormat("int32", {
    type: "number",
    validate: (x) => x % 1 === 0 && x >= -2_147_483_648 && x <= 2_147_483_647,
  });

  // TODO int64 range exceed Number.MAX_SAFE_INTEGER so we will lost precision when JSON.parse
  ajv.addFormat("int64", {
    type: "number",
    validate: (x) =>
      x % 1 === 0 && x >= -9_223_372_036_854_775_808n && x <= 9_223_372_036_854_775_807n,
  });

  ajv.addFormat("unixtime", {
    type: "number",
    validate: (x) => x % 1 === 0,
  });

  for (const format of ["double", "float", "decimal"]) {
    ajv.addFormat(format, {
      type: "number",
      validate: () => true,
    });
  }

  for (const format of ["byte", "password", "file"]) {
    ajv.addFormat(format, {
      type: "string",
      validate: () => true,
    });
  }

  // https://tools.ietf.org/html/rfc822#section-5
  ajv.addFormat("date-time-rfc1123", {
    type: "string",
    validate: /^(?:(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), )?[0-3]\d (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d\d(?:\d\d)? (?:[0-2]\d:[0-5]\d(?::[0-5]\d)|23:59:60) (?:[A-Z]{1,3})?(?:[+-]\d\d\d\d)?$/,
  });

  // https://en.wikipedia.org/wiki/ISO_8601#Durations
  ajv.addFormat("duration", {
    type: "string",
    validate: /^P([0-9]+(?:[,\.][0-9]+)?Y)?([0-9]+(?:[,\.][0-9]+)?M)?([0-9]+(?:[,\.][0-9]+)?D)?(?:T([0-9]+(?:[,\.][0-9]+)?H)?([0-9]+(?:[,\.][0-9]+)?M)?([0-9]+(?:[,\.][0-9]+)?S)?)?$/,
  });

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
  //   "x-ms-mutability",
  //   "x-ms-client-name",
  //   "x-ms-external",
  //   "x-ms-skip-url-encoding",
  //   "x-ms-client-flatten",
  //   "x-ms-api-version",
  //   "x-ms-secret",
  //   "x-ms-parameter-grouping",
  //   "x-ms-discriminator-value",
  //   "x-ms-client-request-id",
  //   "x-apim-code-nillable",
  //   "x-new-pattern",
  //   "x-previous-pattern",
  //   "x-comment",
  //   "x-abstract",
  //   "discriminator",
  //   "allowEmptyValue",
  //   "collectionFormat",
  // ]) {
  //   ajv.addKeyword(keyword, {});
  // }

  return ajv;
};
