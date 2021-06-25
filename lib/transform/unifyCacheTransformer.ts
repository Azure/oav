import { arrayKeywords, propsKeywords, keywords } from "json-schema-traverse";
import { Operation, Parameter, Path, Schema } from "../swagger/swaggerTypes";
import { GlobalTransformer, TransformerType } from "./transformer";
import { traverseSwagger } from "./traverseSwagger";

// Must be the final transformer
export const unifyCacheTransformer: GlobalTransformer = {
  type: TransformerType.Global,
  transform({ allSpecs, jsonLoader }) {
    const visited = new Map<Schema, string>();

    const visitNestedDefinitions = (s: Schema | undefined): Schema | undefined => {
      if (s === undefined || s === null || typeof s !== "object") {
        return s;
      }
      const schema = jsonLoader.resolveRefObj(s);
      const target = visited.get(schema);
      if (target !== undefined) {
        return { $ref: target };
      }

      const tempRefObj = { $ref: "__NOT_DETERMINED__" };
      let modelCacheKey = jsonLoader.preserveModelCacheKey(tempRefObj);
      const { $ref } = jsonLoader.refObjToModelCache(modelCacheKey);

      visited.set(schema, $ref);

      for (const key of Object.keys(schema)) {
        const sch = (schema as any)[key];
        if (Array.isArray(sch)) {
          if (key in arrayKeywords) {
            for (let idx = 0; idx < sch.length; ++idx) {
              sch[idx] = visitNestedDefinitions(sch[idx]);
            }
          }
        } else if (key in propsKeywords) {
          if (typeof sch === "object" && sch !== null) {
            for (const prop of Object.keys(sch)) {
              sch[prop] = visitNestedDefinitions(sch[prop]);
            }
          }
        } else if (key in keywords) {
          (schema as any)[key] = visitNestedDefinitions(sch);
        }
      }

      modelCacheKey = jsonLoader.getModelCacheKey(schema);
      const refObj = jsonLoader.refObjToModelCache(modelCacheKey);
      tempRefObj.$ref = refObj.$ref;
      return refObj;
    };

    const visitParameter = (p: Parameter) => {
      const param = jsonLoader.resolveRefObj(p);
      if (param.in === "body") {
        param.schema = visitNestedDefinitions(param.schema);
      }
    };

    const visitParameters = (x: Path | Operation) => {
      if (x.parameters !== undefined) {
        for (const p of x.parameters) {
          visitParameter(p);
        }
      }
    };

    for (const spec of allSpecs) {
      if (spec.definitions !== undefined) {
        for (const defKey of Object.keys(spec.definitions)) {
          spec.definitions[defKey] = visitNestedDefinitions(spec.definitions[defKey])!;
        }
      }
      if (spec.parameters !== undefined) {
        for (const defKey of Object.keys(spec.parameters)) {
          visitParameter(spec.parameters[defKey]);
        }
      }
      traverseSwagger(spec, {
        onPath: visitParameters,
        onOperation: visitParameters,
        onResponse: (response) => {
          response.schema = visitNestedDefinitions(response.schema);
        },
      });
    }
  },
};
