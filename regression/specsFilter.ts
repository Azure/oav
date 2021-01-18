import * as path from "path";
import glob = require("glob");
import * as _ from "lodash";

const specPaths: string[] = glob
  .sync(path.join(__dirname, "azure-rest-api-specs/specification/**/*.json"))
  .filter((p: string) => !p.includes("examples"));

const versionRegex = /[0-9]+[0-9-]+[^\/]*/;
const rpRegex = /(?:\/)Microsoft.[^\/]*/;
const latestForEachRp = ((_.chain(specPaths)
  .filter((p) => p.includes("stable")) // only look at stable specs
  .filter((p) => Boolean(p.match(rpRegex)))
  .groupBy((p: string) => p.match(rpRegex)![0]) // group paths by rp
  .entries()
  .map((entry: [string, string[]]) =>
    // for each rp get latest version
    _.chain(entry[1])
      .filter((p) => Boolean(p!.match(versionRegex)))
      .groupBy((p: string) => p!.match(versionRegex)![0])
      .entries()
      .sortBy(([version]: [string, string[]]) => version)
      .map((e: [string, string[]]) => e[1])
      .last()
      .value()
  ) as any)
  .flatten()
  .value() as unknown) as string[];

export const latestSpecsOnly = specPaths.filter((p: string) => latestForEachRp.includes(p));
export const allSpecs = specPaths.filter((p: string) => !latestForEachRp.includes(p));
