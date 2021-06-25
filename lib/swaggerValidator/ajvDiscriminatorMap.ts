import { default as Ajv, ErrorObject, ValidateFunction } from "ajv";
import { JsonLoader } from "../swagger/jsonLoader";
import { Schema } from "../swagger/swaggerTypes";

export const ajvEnableDiscriminatorMap = (ajv: Ajv, loader: JsonLoader) => {
  ajv.addKeyword({
    errors: "full",
    keyword: "discriminatorMap",
    metaSchema: { type: "object", additionalProperty: { type: "object,null" } },

    compile(schemas: { [key: string]: Schema }, _parentSchema: any) {
      const parentSchema: Schema = _parentSchema;
      const compiled: { [key: string]: ValidateFunction | null } = {};
      const schemaMap: { [key: string]: Schema } = {};
      for (const value of Object.keys(schemas)) {
        compiled[value] = schemas[value] === null ? null : ajv.compile(schemas[value]);
        schemaMap[value] =
          schemas[value] === null ? parentSchema : loader.resolveRefObj(schemas[value]);
      }
      const discriminator = parentSchema.discriminator;
      if (discriminator === undefined) {
        throw new Error("Discriminator is absent");
      }
      const validated = new WeakSet<Schema>();
      const allowedValues = Object.keys(schemas);

      return function v(this: any, data: any, dataCxt) {
        if (data === null || data === undefined || typeof data !== "object") {
          // Should be validated by other schema property.
          return true;
        }
        const dataPath = dataCxt?.instancePath ?? "";
        const discriminatorValue = data[discriminator];
        const validate =
          discriminatorValue !== undefined && discriminatorValue !== null
            ? compiled[discriminatorValue]
            : undefined;

        if (validated.has(data)) {
          return true;
        }
        validated.add(data);
        const errors: ErrorObject[] = [];

        const sch = schemaMap[discriminatorValue] ?? parentSchema;

        if (validate === undefined || validate === null) {
          (v as any).errors = [
            {
              keyword: "discriminatorMap",
              data,
              instancePath: dataPath,
              params: {
                allowedValues,
                discriminatorValue,
                schemaPath: "/discriminator",
                schema: schemas,
                data,
              },
              schemaPath: "/discriminator",
              schema: schemas,
              parentSchema,
            } as ErrorObject,
          ];
          return false;
        }
        if (validate !== undefined && validate !== null) {
          const valid = validate.call(this, data);
          if (!valid && validate.errors) {
            for (const err of validate.errors) {
              err.instancePath = dataPath + err.instancePath;
              if (err.params.schemaPath === undefined) {
                err.params.schemaPath = err.schemaPath;
                err.params.schema = err.schema;
                err.params.data = err.data;
              }
            }
            errors.push(...validate.errors);
          }
        }

        if (
          sch.properties !== undefined &&
          sch.additionalProperties === undefined &&
          parentSchema.properties !== undefined &&
          parentSchema.additionalProperties === undefined
        ) {
          // We validate { additionalProperties: false } manually if it's not set
          for (const key of Object.keys(data)) {
            if (!(key in sch.properties)) {
              errors.push({
                keyword: "additionalProperties",
                data,
                instancePath: dataPath,
                params: {
                  additionalProperty: key,
                  schemaPath: "/additionalProperties",
                  schema: false,
                  data,
                },
                schemaPath: "/additionalProperties",
                schema: false,
                parentSchema,
              } as ErrorObject);
            }
          }
        }

        if (errors.length > 0) {
          (v as any).errors = errors;
          return false;
        } else {
          (v as any).errors = null;
          return true;
        }
      };
    },
  });
};
