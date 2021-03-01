import * as jsonpatch from "fast-json-patch";

export class ExampleDiff {
  constructor(private suppression?: string, private output?: string) {}

  public diff(newObj: any, oldObj: any) {
    const delta: jsonpatch.Operation[] = jsonpatch.compare(newObj, oldObj);
    console.log(delta);
    console.log(this.suppression);
    console.log(this.output);
  }
}

interface DiffOpt {
  ignoreReplaceInResponse: boolean;
  ignoreRemovedResponse: boolean;
  suppressionPath: string[];
  suppressionVariables: string[];
}

export const exampleDiff = (
  newObj: any,
  oldObj: any,
  diffOpt: DiffOpt = {
    ignoreRemovedResponse: true,
    ignoreReplaceInResponse: true,
    suppressionPath: [],
    suppressionVariables: [],
  }
) => {
  const delta = jsonpatch.compare(newObj, oldObj);
  const res: jsonpatch.Operation[] = [];
  for (const it of delta) {
    if (
      diffOpt.suppressionPath.indexOf(it.path) !== -1 ||
      diffOpt.suppressionVariables.some((v) => {
        const value = (it as any).value;
        if (
          it.path.includes(v) ||
          (value !== undefined && typeof value === "string" && value.includes(v))
        ) {
          return true;
        } else {
          return false;
        }
      })
    ) {
      continue;
    }

    if (diffOpt.ignoreReplaceInResponse) {
      if (it.op === "replace" && it.path.includes("responses")) {
        continue;
      }
    }

    if (diffOpt.ignoreRemovedResponse) {
      if (it.op === "remove" && it.path.match(/\/responses\/\d+/)) {
        continue;
      }
    }
    res.push(it);
  }
  return res;
};
