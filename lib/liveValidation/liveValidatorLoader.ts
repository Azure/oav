import { copyInfo, StringMap } from "@azure-tools/openapi-tools-common";

import { JsonLoader } from "../swagger/jsonLoader";
import { getLoaderBuilder, Loader, setDefaultOpts } from "../swagger/loader";
import { SwaggerLoader, SwaggerLoaderOption } from "../swagger/swaggerLoader";
import {
  Operation,
  Parameter,
  PathParameter,
  QueryParameter,
  Response,
  Schema,
  SwaggerSpec,
} from "../swagger/swaggerTypes";
import { AjvSchemaValidator } from "../swaggerValidator/ajvSchemaValidator";
import { SchemaValidateFunction, SchemaValidatorOption } from "../swaggerValidator/schemaValidator";
import { allOfTransformer } from "../transform/allOfTransformer";
import { getTransformContext, TransformContext } from "../transform/context";
import { discriminatorTransformer } from "../transform/discriminatorTransformer";
import { noAdditionalPropertiesTransformer } from "../transform/noAdditionalPropertiesTransformer";
import { nullableTransformer } from "../transform/nullableTransformer";
import { pathRegexTransformer } from "../transform/pathRegexTransformer";
import { pureObjectTransformer } from "../transform/pureObjectTransformer";
import { referenceFieldsTransformer } from "../transform/referenceFieldsTransformer";
import { resolveNestedDefinitionTransformer } from "../transform/resolveNestedDefinitionTransformer";
import { schemaV4ToV7Transformer } from "../transform/schemaV4ToV7Transformer";
import { applyGlobalTransformers, applySpecTransformers } from "../transform/transformer";
import { traverseSwaggerAsync } from "../transform/traverseSwagger";
import { xmsPathsTransformer } from "../transform/xmsPathsTransformer";
import { getLazyBuilder } from "../util/lazyBuilder";
import { waitUntilLowLoad } from "../util/utils";
import { allErrorConstants } from "../util/validationError";

export interface LiveValidatorLoaderOptions extends SwaggerLoaderOption, SchemaValidatorOption {
  transformToNewSchemaFormat?: boolean;
}

export class LiveValidatorLoader implements Loader<SwaggerSpec> {
  private swaggerLoader: SwaggerLoader;
  private jsonLoader: JsonLoader;

  public readonly transformContext: TransformContext;
  public readonly schemaValidator: AjvSchemaValidator;

  public getResponseValidator = getLazyBuilder(
    "_validate",
    (response: Response): Promise<SchemaValidateFunction> => {
      const schema: Schema = { properties: {} };
      if (response.schema !== undefined && (response.schema.type as string) !== "file") {
        schema.properties!.body = response.schema;
        copyInfo(response, response.schema);
        this.addRequiredToSchema(schema, "body");
      }
      if (response.headers !== undefined) {
        const headerSchema: Schema = { properties: {}, required: [] };
        copyInfo(response.headers, headerSchema);
        schema.properties!.headers = headerSchema;
        for (const headerName of Object.keys(response.headers)) {
          const name = headerName.toLowerCase();
          const sch = response.headers[headerName];
          headerSchema.properties![name] = sch;
          headerSchema.required!.push(name);
          addParamTransform(response, { type: sch.type, name, in: "header" });
        }
        if (headerSchema.required?.length === 0) {
          headerSchema.required = undefined;
        }
      } else {
        schema.properties!.headers = {};
      }
      return this.schemaValidator.compileAsync(schema);
    }
  );

  public getRequestValidator = getLazyBuilder(
    "_validate",
    (operation: Operation): Promise<SchemaValidateFunction> => {
      const schema: Schema = {
        properties: {
          query: { properties: {} },
          headers: { properties: {} },
          path: { properties: {} },
        },
      };
      this.addParamToSchema(schema, operation._path.parameters, operation);
      this.addParamToSchema(schema, operation.parameters, operation);
      return this.schemaValidator.compileAsync(schema);
    }
  );

  public static create = getLoaderBuilder(
    (opts: LiveValidatorLoaderOptions) => new LiveValidatorLoader(opts)
  );
  private constructor(private opts: LiveValidatorLoaderOptions) {
    setDefaultOpts(opts, {
      transformToNewSchemaFormat: false,
      loadSuppression: Object.keys(allErrorConstants),
    });

    this.jsonLoader = JsonLoader.create(opts);
    this.swaggerLoader = SwaggerLoader.create(opts);
    const schemaValidatorOption: SchemaValidatorOption = { isArmCall: opts.isArmCall };

    this.schemaValidator = new AjvSchemaValidator(
      this.jsonLoader,
      undefined,
      schemaValidatorOption
    );

    this.transformContext = getTransformContext(this.jsonLoader, this.schemaValidator, [
      xmsPathsTransformer,
      resolveNestedDefinitionTransformer,
      this.opts.transformToNewSchemaFormat ? schemaV4ToV7Transformer : undefined,
      referenceFieldsTransformer,
      pathRegexTransformer,

      discriminatorTransformer,
      allOfTransformer,
      noAdditionalPropertiesTransformer,
      nullableTransformer,
      pureObjectTransformer,
    ]);
  }

  public async load(specFilePath: string): Promise<SwaggerSpec> {
    const spec = await this.swaggerLoader.load(specFilePath);

    applySpecTransformers(spec, this.transformContext);

    return spec;
  }

  public transformLoadedSpecs() {
    applyGlobalTransformers(this.transformContext);
  }

  public async buildAjvValidator(spec: SwaggerSpec, options?: { inBackground?: boolean }) {
    return traverseSwaggerAsync(spec, {
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
          } else {
            operation._bodyTransform = bodyTransformIfNotRequiredAndEmpty;
          }
          break;

        case "header":
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

const bodyTransformIfNotRequiredAndEmpty = (body: any) => {
  if (body && Object.keys(body).length === 0 && body.constructor === Object) {
    return undefined;
  } else {
    return body;
  }
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
    it._headerTransform[param.name.toLowerCase()] = transform;
  }
};
