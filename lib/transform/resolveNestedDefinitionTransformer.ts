import { arrayKeywords, keywords, propsKeywords } from "json-schema-traverse";
import { $id } from "../swagger/jsonLoader";
import { Operation, Path, refSelfSymbol, Schema } from "../swagger/swaggerTypes";
import { SpecTransformer, TransformerType } from "./transformer";
import { traverseSwagger } from "./traverseSwagger";

const visited = new WeakSet<Schema>();

export const resolveNestedDefinitionTransformer: SpecTransformer = {
  type: TransformerType.Spec,
  transform(spec, { jsonLoader, objSchemas, arrSchemas, primSchemas, allParams, allSpecs }) {
    const visitNestedDefinitions = (s: Schema | undefined, ref?: string) => {
      if (s === undefined || s === null || typeof s !== "object") {
        return;
      }
      const schema = jsonLoader.resolveRefObj(s);
      if (visited.has(schema)) {
        return;
      }
      visited.add(schema);

      const refSelf = schema === s ? ref : (s as any).$ref;
      if (refSelf !== undefined) {
        schema[refSelfSymbol] = refSelf;
      }
      if (schema.type === undefined || schema.type === "object") {
        objSchemas.push(schema);
      } else if (schema.type === "array") {
        arrSchemas.push(schema);
      } else {
        primSchemas.push(schema);
      }

      for (const key of Object.keys(schema)) {
        const sch = (schema as any)[key];
        const refSch = refSelf?.concat("/", key);
        if (Array.isArray(sch)) {
          if (key in arrayKeywords) {
            for (let idx = 0; idx < sch.length; ++idx) {
              visitNestedDefinitions(sch[idx], refSch?.concat("/", idx.toString()));
            }
          }
        } else if (key in propsKeywords) {
          if (typeof sch === "object" && sch !== null) {
            for (const prop of Object.keys(sch)) {
              visitNestedDefinitions(sch[prop], refSch?.concat("/", prop));
            }
          }
        } else if (key in keywords) {
          visitNestedDefinitions(sch, refSch);
        }
      }
    };

    const visitParameters = (x: Path | Operation) => {
      if (x.parameters !== undefined) {
        for (const p of x.parameters) {
          const param = jsonLoader.resolveRefObj(p);
          if (param.in === "body") {
            visitNestedDefinitions(param.schema);
          }
          allParams.push(param);
        }
      }
    };

    traverseSwagger(spec, {
      onPath: visitParameters,
      onOperation: visitParameters,
      onResponse: (response) => {
        visitNestedDefinitions(response.schema);
      },
    });

    if (spec.definitions !== undefined) {
      for (const key of Object.keys(spec.definitions)) {
        visitNestedDefinitions(spec.definitions[key], `${spec[$id]}#/definitions/${key}`);
      }
    }

    if (spec.parameters !== undefined) {
      for (const key of Object.keys(spec.parameters)) {
        spec.parameters[key][refSelfSymbol] = `${spec[$id]}#/parameters/${key}`;
      }
    }

    allSpecs.push(spec);
  },
};
