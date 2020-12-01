import { default as Ajv, ErrorObject, ValidateFunction } from "ajv";
import { JsonLoader } from "../swagger/jsonLoader";
import { Schema } from "../swagger/swaggerTypes";

export const ajvEnableDiscriminatorMap = (ajv: Ajv, loader: JsonLoader) => {
  ajv.addKeyword({
    keyword: "discriminatorMap",
    errors: "full",
    metaSchema: {
      type: "object",
      additionalProperties: { type: "object", nullable: true },
    },

    compile(schemas: { [key: string]: Schema }, parentSch) {
      const parentSchema = parentSch as Schema;
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
        let dataPath = dataCxt!.dataPath;
        if (data === null || data === undefined || typeof data !== "object") {
          // Should be validated by other schema property.
          return true;
        }
        dataPath = dataPath ?? "";
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
              dataPath,
              params: { allowedValues, discriminatorValue },
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
              err.dataPath = dataPath + err.dataPath;
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
                dataPath,
                params: { additionalProperty: key },
                schemaPath: "/additionalProperties",
                schema: false,
                parentSchema,
              });
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
