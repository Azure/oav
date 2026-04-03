import { allOfTransformer } from "./allOfTransformer.js";
import { GlobalTransformer, TransformerType } from "./transformer.js";

export const noAdditionalPropertiesTransformer: GlobalTransformer = {
  type: TransformerType.Global,
  after: [allOfTransformer],
  transform({ objSchemas, baseSchemas }) {
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
  },
};
