import { relative as pathRelative } from "path";
import { parse as urlParse } from "url";
import { Ajv, ValidateFunction } from "ajv";
import { StringMap } from "@ts-common/string-map";
import { copyInfo } from "@ts-common/source-map";

import { buildPathRegex } from "../util/path";
import {
  xmsParameterizedHost,
  xNullable,
  xmsPaths,
  xmsDiscriminatorValue,
} from "../util/constants";
import { waitUntilLowLoad } from "../util/utils";
import { getLazyBuilder } from "../util/lazyBuilder";
import {
  Operation,
  Parameter,
  Schema,
  Response,
  SwaggerSpec,
  PathParameter,
  QueryParameter,
  refSelfSymbol,
} from "./swaggerTypes";
import { FileSystemJsonLoader, isRefLike } from "./fileSystemJsonLoader";
import { SwaggerLoader, AllSchemas } from "./swaggerLoader";
import { initLiveValidatorAjv } from "./ajv";

interface Options {
  transformToNewSchemaFormat?: boolean;
}

export class SwaggerLiveValidatorLoader extends SwaggerLoader {
  public readonly ajv: Ajv;

  private visited = new Set<Schema>();

  public getResponseValidator = getLazyBuilder(
    "_validate",
    async (response: Response): Promise<ValidateFunction> => {
      const schema: Schema = { properties: {} };
      if (response.schema !== undefined && (response.schema.type as string) !== "file") {
        schema.properties!.body = response.schema;
        copyInfo(response, response.schema);
        this.addRequiredToSchema(schema, "body");
      }
      if (response.headers !== undefined) {
        const headerSchema: Schema = { properties: {}, required: [] };
        schema.properties!.headers = headerSchema;
        for (const headerName of Object.keys(response.headers)) {
          const name = headerName.toLowerCase();
          headerSchema.properties![name] = response.headers[headerName];
          // TODO headerSchema.required!.push(name);
          addParamTransform(response, { type: schema.type!, name, in: "header" });
        }
        if (headerSchema.required?.length === 0) {
          headerSchema.required = undefined;
        }
      }
      const validate = await this.ajv.compileAsync(schema);
      return validate;
    }
  );

  public getRequestValidator = getLazyBuilder(
    "_validate",
    async (operation: Operation): Promise<ValidateFunction> => {
      const schema: Schema = { properties: {} };
      this.addParamToSchema(schema, operation._path.parameters, operation);
      this.addParamToSchema(schema, operation.parameters, operation);
      return await this.ajv.compileAsync(schema);
    }
  );

  public constructor(private rootDirPath: string, private options: Options) {
    super(
      new FileSystemJsonLoader(rootDirPath, {
        useVfs: false,
        useJsonParser: true,
        eraseDescription: true,
        eraseXmsExamples: true,
        transformRef: true,
      })
    );

    this.ajv = initLiveValidatorAjv(this.jsonLoader);
  }

  public async loadSpec(specFilePath: string): Promise<SwaggerSpec> {
    const filePath = pathRelative(this.rootDirPath, specFilePath);
    const spec = await super.loadSpec(filePath);

    this.transformXmsPath(spec);

    this.setReferenceFields(spec);

    this.buildPathRegex(spec);

    return spec;
  }

  public transformLoadedSpecs() {
    const newSchemas: AllSchemas = {
      objSchemas: [],
      arrSchemas: [],
      primSchemas: [],
      allParams: [],
    };

    const newSpecs = this.jsonLoader.getLoadedFiles();
    for (const spec of newSpecs) {
      this.getAllNestedDefinitions(spec, this.visited, newSchemas);
    }

    if (this.options.transformToNewSchemaFormat) {
      this.transformSchemaToNewVersion(newSchemas);
    }

    const baseSchemas = new Set<Schema>();
    this.transformDiscriminator(newSchemas, baseSchemas);

    this.transformAllOf(newSchemas, baseSchemas);

    this.transformNoAdditionalProperties(newSchemas, baseSchemas);

    this.transformNullable(newSchemas);

    this.transformPureObject(newSchemas);
  }

  public async buildAjvValidator(spec: SwaggerSpec, options?: { inBackground?: boolean }) {
    return this.traverseSwaggerAsync(spec, {
      onOperation: async (operation) => {
        await this.getRequestValidator(operation);
        if (options?.inBackground) {
          await waitUntilLowLoad();
        }
      },
      onResponse: async (response) => {
        await this.getResponseValidator(response);
        if (options?.inBackground) {
          await waitUntilLowLoad();
        }
      },
    });
  }

  private buildPathRegex(spec: SwaggerSpec) {
    let basePathPrefix = spec.basePath ?? "";
    if (basePathPrefix.endsWith("/")) {
      basePathPrefix = basePathPrefix.substr(0, basePathPrefix.length - 1);
    }
    const msParameterizedHost = spec[xmsParameterizedHost];
    const hostTemplate = msParameterizedHost?.hostTemplate ?? "";

    this.traverseSwagger(spec, {
      onPath: (path, pathTemplate) => {
        let pathStr = pathTemplate;
        const queryIdx = pathTemplate.indexOf("?");
        if (queryIdx !== -1) {
          // path in x-ms-paths has query part we need to match
          const queryMatch = urlParse(pathStr, true).query;
          const querySchema: Schema = { type: "object", properties: {}, required: [] };
          for (const queryKey of Object.keys(queryMatch)) {
            const queryVal = queryMatch[queryKey];
            querySchema.required!.push(queryKey);
            querySchema.properties![queryKey] = {
              enum: typeof queryVal === "string" ? [queryVal] : queryVal,
            };
          }
          path._validateQuery = this.ajv.compile(querySchema);
          pathStr = pathTemplate.substr(0, queryIdx);
        }
        path._pathRegex = buildPathRegex(hostTemplate, basePathPrefix, pathStr);
      },
      onOperation: (operation) => {
        if (operation.externalDocs !== undefined) {
          operation.externalDocs = undefined;
        }
      },
      onResponse: (response) => {
        if (response.examples !== undefined) {
          response.examples = undefined;
        }
      },
    });
  }

  private transformXmsPath(spec: SwaggerSpec) {
    const xPaths = spec[xmsPaths];
    if (xPaths !== undefined) {
      const paths = spec.paths;
      for (const pathTemplate of Object.keys(xPaths)) {
        paths[pathTemplate] = xPaths[pathTemplate];
      }
      spec[xmsPaths] = undefined;
    }
  }

  private transformSchemaToNewVersion({ primSchemas }: AllSchemas) {
    // Transform from json schema draft 04 to draft 07
    for (const sch of primSchemas) {
      if (typeof sch.exclusiveMinimum === "boolean") {
        sch.exclusiveMinimum = sch.exclusiveMinimum ? sch.minimum : sch.minimum! - 1;
      }
      if (typeof sch.exclusiveMaximum === "boolean") {
        sch.exclusiveMaximum = sch.exclusiveMaximum ? sch.maximum : sch.maximum! + 1;
      }
    }
  }

  private getDiscriminatorRoot(
    sch: Schema,
    baseSchemas: Set<Schema>,
    visited: Map<Schema, string | null>
  ): string | null {
    if (sch.discriminator !== undefined) {
      return sch[refSelfSymbol] ?? null;
    }
    if (sch.allOf === undefined) {
      return null;
    }
    let root = visited.get(sch);
    if (root !== undefined) {
      return root;
    }
    visited.set(sch, null);
    for (let subSch of sch.allOf) {
      if (!isRefLike(subSch)) {
        continue;
      }
      subSch = this.jsonLoader.resolveRefObj(subSch);
      root = this.getDiscriminatorRoot(subSch, baseSchemas, visited);
      if (root !== null) {
        baseSchemas.add(subSch);
        visited.set(sch, root);
        return root;
      }
    }
    return null;
  }

  private getDiscriminatorValue(sch: Schema) {
    const discriminatorValue = sch[xmsDiscriminatorValue] ?? getNameFromRef(sch);
    if (discriminatorValue === undefined) {
      throw new Error("undefined discriminatorValue!");
    }
    return discriminatorValue;
  }

  private transformDiscriminator({ objSchemas }: AllSchemas, baseSchemas: Set<Schema>) {
    const visited = new Map<Schema, string | null>();
    for (const sch of objSchemas) {
      if (sch.allOf === undefined) {
        continue;
      }
      const rootRef = this.getDiscriminatorRoot(sch, baseSchemas, visited);
      if (rootRef === null) {
        continue;
      }

      const baseSch = this.jsonLoader.resolveRefObj({ $ref: rootRef } as Schema);
      const $ref = sch[refSelfSymbol];
      const discriminatorValue = this.getDiscriminatorValue(sch);

      if (baseSch.discriminatorMap === undefined) {
        baseSch.discriminatorMap = {
          [this.getDiscriminatorValue(baseSch)]: null,
        };
        copyInfo(baseSch, baseSch.discriminatorMap);
      }
      baseSch.discriminatorMap[discriminatorValue] = ({ $ref } as unknown) as Schema;
    }
  }

  private transformAllOfSchema(schema: Schema, baseSchemas: Set<Schema>) {
    if (schema.type !== undefined && schema.type !== "object") {
      return;
    }
    if (schema.allOf === undefined) {
      return;
    }

    if (schema.properties === undefined) {
      schema.properties = {};
    }
    for (const s of schema.allOf) {
      const sch = this.jsonLoader.resolveRefObj(s);
      this.transformAllOfSchema(sch, baseSchemas);

      const { properties, required, additionalProperties: aProperties } = sch;
      if (properties !== undefined) {
        for (const propertyName of Object.keys(properties)) {
          if (!(propertyName in schema.properties)) {
            schema.properties[propertyName] = properties[propertyName];
          }
        }
      }
      if (required !== undefined && required.length > 0) {
        if (schema.required === undefined) {
          schema.required = required;
        } else {
          for (const key of required) {
            if (!schema.required.includes(key)) {
              schema.required.push(key);
            }
          }
        }
      }
      if (aProperties !== undefined && schema.additionalProperties === undefined) {
        // schema.additionalProperties = aProperties;
      }
    }
    if (!baseSchemas.has(schema) || schema.discriminator !== undefined) {
      // A -> B -> C, A has discriminator and B don't have, and C has discriminatorValue
      // If some schema references B, then we need to depends on B's allOf to validate on A
      // which will finally validate C via discriminatorMap. In this case we won't remove
      // allOf on B, which is: isBaseSchema && discriminator === undefined
      delete schema.allOf;
    }
  }

  private transformAllOf({ objSchemas }: AllSchemas, baseSchemas: Set<Schema>) {
    for (const sch of objSchemas) {
      if (sch.allOf !== undefined) {
        this.transformAllOfSchema(sch, baseSchemas);
      }
    }
  }

  private transformNoAdditionalProperties({ objSchemas }: AllSchemas, baseSchemas: Set<Schema>) {
    for (const sch of objSchemas) {
      if (
        sch.additionalProperties === undefined &&
        sch.discriminator === undefined &&
        !baseSchemas.has(sch) &&
        sch.properties &&
        Object.keys(sch.properties).length > 0
      ) {
        sch.additionalProperties = false;
      }
    }
  }

  private transformNullable({ objSchemas, allParams }: AllSchemas) {
    for (const sch of objSchemas) {
      if (sch.properties !== undefined) {
        for (const key of Object.keys(sch.properties)) {
          const subS = sch.properties[key];
          const subSch = this.jsonLoader.resolveRefObj(subS);
          const nullable = subSch[xNullable] ?? !sch.required?.includes(key);
          if (!nullable) {
            continue;
          }
          if (subS === subSch || subSch[xNullable]) {
            subSch.nullable = true;
          } else {
            sch.properties[key] = {
              anyOf: [subS, { type: "null", _skipError: true }],
              _skipError: true,
            };
          }
        }
      }

      const aProperty = sch.additionalProperties;
      if (typeof aProperty === "object" && aProperty !== null) {
        if (isRefLike(aProperty)) {
          sch.additionalProperties = {
            anyOf: [aProperty, { type: "null", _skipError: true }],
            _skipError: true,
          };
        } else if (aProperty[xNullable] !== false) {
          aProperty.nullable = true;
        }
      }
    }

    for (const param of allParams) {
      if (param.in === "query" && param.allowEmptyValue) {
        param.nullable = true;
      }
    }
  }

  private transformPureObject = ({ objSchemas }: AllSchemas) => {
    for (const sch of objSchemas) {
      if (
        sch.type === "object" &&
        (sch.properties === undefined || Object.keys(sch.properties).length === 0) &&
        sch.additionalProperties === undefined
      ) {
        delete sch.type;
      }
    }
  };

  private addRequiredToSchema(schema: Schema, requiredName: string) {
    if (schema.required === undefined) {
      schema.required = [];
    }
    if (!schema.required.includes(requiredName)) {
      schema.required.push(requiredName);
    }
  }

  private addParamToSchema(schema: Schema, params: Parameter[] | undefined, operation: Operation) {
    if (params === undefined) {
      return;
    }

    const properties = schema.properties!;
    for (const p of params) {
      const param = this.jsonLoader.resolveRefObj(p);
      switch (param.in) {
        case "body":
          properties.body = param.schema ?? {};
          if (param.required) {
            copyInfo(param, schema);
            this.addRequiredToSchema(schema, "body");
          }
          break;

        case "header":
          properties.headers = properties.headers ?? {
            properties: {},
          };
          const name = param.name.toLowerCase();
          if (param.required) {
            this.addRequiredToSchema(properties.headers, name);
          }
          param.required = undefined;
          properties.headers.properties![name] = param as Schema;
          addParamTransform(operation, param);
          break;

        case "query":
          if (shouldSkipQueryParam(param)) {
            break;
          }
          properties.query = properties.query ?? {
            properties: {},
          };
          if (param.required) {
            this.addRequiredToSchema(properties.query, param.name);
          }
          // Remove param.required as it have different meaning in swagger and json schema
          param.required = undefined;
          properties.query.properties![param.name] = param as Schema;
          addParamTransform(operation, param);
          break;

        case "path":
          if (shouldSkipPathParam(param)) {
            break;
          }
          properties.path = properties.path ?? {
            properties: {},
          };
          // if (!param.required) {
          //   throw new Error("Path property mush be required");
          // }
          this.addRequiredToSchema(properties.path, param.name);
          param.required = undefined;
          properties.path.properties![param.name] = param as Schema;
          break;

        default:
          throw new Error(`Not Supported parameter in: ${param.in}`);
      }
    }
  }
}

const skipPathParamProperties: StringMap<boolean | string> = {
  in: "path",
  name: true,
  type: "string",
  description: true,
  required: true,
};
const shouldSkipPathParam = (param: PathParameter) => {
  for (const key of Object.keys(param)) {
    const val = skipPathParamProperties[key];
    if (val !== true && val !== (param as any)[key]) {
      return false;
    }
  }
  return true;
};

const skipQueryParamProperties: StringMap<boolean | string> = {
  in: "query",
  name: true,
  type: "string",
  description: true,
  required: true,
};
const shouldSkipQueryParam = (param: QueryParameter) => {
  if (param.name !== "api-version") {
    return false;
  }
  for (const key of Object.keys(param)) {
    const val = skipQueryParamProperties[key];
    if (val !== true && val !== (param as any)[key]) {
      return false;
    }
  }
  return true;
};

const paramTransformInteger = (data: string) => {
  const val = Number(data);
  return isNaN(val) ? data : val;
};

const paramTransformBoolean = (data: string) => {
  const val = data.toLowerCase();
  return val === "true" ? true : val === "false" ? false : data;
};

const parameterTransform = {
  number: paramTransformInteger,
  integer: paramTransformInteger,
  boolean: paramTransformBoolean,
};

const addParamTransform = (it: Operation | Response, param: Parameter) => {
  const transform = parameterTransform[param.type! as keyof typeof parameterTransform];
  if (transform === undefined) {
    return;
  }
  if (param.in === "query") {
    const op = it as Operation;
    if (op._queryTransform === undefined) {
      op._queryTransform = {};
    }
    op._queryTransform[param.name] = transform;
  } else if (param.in === "header") {
    if (it._headerTransform === undefined) {
      it._headerTransform = {};
    }
    it._headerTransform[param.name] = transform;
  }
};

export const getNameFromRef = (sch: Schema | undefined) => {
  const sp = sch?.[refSelfSymbol]?.split("/");
  return sp === undefined ? undefined : sp[sp.length - 1];
};
