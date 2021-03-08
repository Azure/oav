import * as fs from "fs";
import * as jsonpatch from "fast-json-patch";

export const diff = (a: any, b: any, variables?: any) => {
  const delta = jsonpatch.compare(a, b);
  console.log(variables);
  console.log(delta);
  fs.writeFileSync("generated_diff/diff.json", JSON.stringify(delta, null, 2));
};
