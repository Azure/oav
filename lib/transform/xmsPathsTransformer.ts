import { xmsPaths } from "../util/constants.js";
import { resolveNestedDefinitionTransformer } from "./resolveNestedDefinitionTransformer.js";
import { SpecTransformer, TransformerType } from "./transformer.js";

export const xmsPathsTransformer: SpecTransformer = {
  type: TransformerType.Spec,
  before: [resolveNestedDefinitionTransformer],
  transform: (spec) => {
    const xPaths = spec[xmsPaths];
    if (xPaths !== undefined) {
      const paths = spec.paths;
      for (const pathTemplate of Object.keys(xPaths)) {
        paths[pathTemplate] = xPaths[pathTemplate];
      }
      spec[xmsPaths] = undefined;
    }
  },
};
