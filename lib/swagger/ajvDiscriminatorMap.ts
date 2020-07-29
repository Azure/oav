import { Ajv, ValidateFunction, ErrorObject } from "ajv";
import { Schema } from "./swaggerTypes";
import { FileSystemJsonLoader } from "./fileSystemJsonLoader";

export const addAjvDiscriminatorMapKeyword = (ajv: Ajv, loader: FileSystemJsonLoader) => {
  ajv.addKeyword("discriminatorMap", {
    errors: "full",
    metaSchema: { type: "object", additionalProperty: { type: "object,null" } },

    compile(schemas: { [key: string]: Schema }, parentSchema: Schema) {
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
      // const allowedValues = Object.keys(schemas);

      return function v(this: any, data: any, dataPath?: string) {
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

        // TODO DISCRIMINATOR_VALUE_NOT_FOUND
        // to conform to the Azure specs, we accept a lenient discriminator. if the type is missing in the
        // payload we use the base class. Also if the type doesn't match anything, we use the base class.
        // if (validate === undefined || validate === null) {
        //   (v as any).errors = [
        //     {
        //       keyword: "discriminatorMap",
        //       data,
        //       dataPath,
        //       params: { allowedValues, discriminatorValue },
        //       schemaPath: "/discriminator",
        //       schema: schemas,
        //       parentSchema,
        //     } as ErrorObject,
        //   ];
        //   return false;
        // }
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
          parentSchema.additionalProperties === undefined &&
          parentSchema.properties
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
