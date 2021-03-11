import * as jsonpatch from "fast-json-patch";

export const jsondiffpatch = require("jsondiffpatch").create({
  // used to match objects when diffing arrays, by default only === operator is used
  objectHash: function (obj: any) {
    // this function is used only to when objects are not equal by ref
    return obj._id || obj.id;
  },
  arrays: {
    // default true, detect items moved inside the array (otherwise they will be registered as remove+add)
    detectMove: true,
    // default false, the value of items moved is not included in deltas
    includeValueOnMove: false,
  },
  textDiff: {
    // default 60, minimum string length (left and right sides) to use text diff algorythm: google-diff-match-patch
    minLength: 60,
  },
  propertyFilter: function (name: any, _context: any) {
    /*
     this optional function can be specified to ignore object properties (eg. volatile data)
      name: property name, present in either context.left or context.right objects
      context: the diff context (has context.left and context.right objects)
    */
    return name.includes("time");
  },
  cloneDiffValues: false /* default false. if true, values in the obtained delta will be cloned
    (using jsondiffpatch.clone by default), to ensure delta keeps no references to left or right objects. this becomes useful if you're diffing and patching the same objects multiple times without serializing deltas.
    instead of true, a function can be specified here to provide a custom clone(value)
    */,
});
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
