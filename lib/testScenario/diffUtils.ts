import { default as stableStringify } from "fast-json-stable-stringify";
import * as jsonPointer from "json-pointer";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
import {
  JsonPatchOp,
  JsonPatchOpAdd,
  JsonPatchOpCopy,
  JsonPatchOpMerge,
  JsonPatchOpMove,
  JsonPatchOpReplace,
  JsonPatchOpTest,
} from "./testResourceTypes";
import { DiffPatcher } from "jsondiffpatch";

interface PatchContext {
  root: any;
  obj: any;
  propertyName: string;
  arrIdx: number;
}
const rootName = "ROOT";

const getCtx = (obj: any, path: string): PatchContext => {
  if (path === "/") {
    path = "";
  }
  const pathSegments = jsonPointer.parse(path);
  pathSegments.unshift(rootName);
  const propertyName = pathSegments.pop()!;
  const target = jsonPointer.get(obj, jsonPointer.compile(pathSegments));
  const result: PatchContext = {
    root: obj,
    obj: target,
    propertyName,
    arrIdx: -1,
  };

  if (Array.isArray(obj)) {
    result.arrIdx = parseInt(propertyName);
  }

  return result;
};

const patchAdd = ({ obj, propertyName, arrIdx }: PatchContext, op: JsonPatchOpAdd) => {
  if (Array.isArray(obj)) {
    obj.splice(arrIdx, 0, op.value);
  } else {
    obj[propertyName] = op.value;
  }
};

const patchRemove = ({ obj, propertyName, arrIdx }: PatchContext) => {
  if (Array.isArray(obj)) {
    obj.splice(arrIdx, 1);
  } else {
    delete obj[propertyName];
  }
};

const patchReplace = ({ obj, propertyName }: PatchContext, op: JsonPatchOpReplace) => {
  obj[propertyName] = op.value;
};

const patchCopy = ({ root, obj, propertyName }: PatchContext, op: JsonPatchOpCopy) => {
  const val = cloneDeep(obj[propertyName]);
  jsonPointer.set(root, `/${rootName}${op.path}`, val);
};

const patchMove = (ctx: PatchContext, op: JsonPatchOpMove) => {
  const { propertyName, obj, root } = ctx;
  const val = obj[propertyName];
  patchRemove(ctx);
  jsonPointer.set(root, `/${rootName}${op.path}`, val);
};

const patchTest = ({ obj, propertyName }: PatchContext, op: JsonPatchOpTest) => {
  const val = obj[propertyName];
  const factStr = stableStringify(val);
  const expectStr = stableStringify(op.value);
  if (factStr !== expectStr) {
    throw new Error(
      `JsonPatch Test failed for path: ${op.test}\nExpect: ${factStr}\nActual: ${factStr}`
    );
  }
};

const patchMerge = ({ obj, propertyName }: PatchContext, op: JsonPatchOpMerge) => {
  const target = obj[propertyName];

  for (const key of Object.keys(op.value)) {
    target[key] = op.value[key];
  }
};

const jsonPatchApplyOp = (obj: any, op: JsonPatchOp) => {
  if ("add" in op) {
    return patchAdd(getCtx(obj, op.add), op);
  }
  if ("remove" in op) {
    return patchRemove(getCtx(obj, op.remove));
  }
  if ("replace" in op) {
    return patchReplace(getCtx(obj, op.replace), op);
  }
  if ("copy" in op) {
    return patchCopy(getCtx(obj, op.copy), op);
  }
  if ("move" in op) {
    return patchMove(getCtx(obj, op.move), op);
  }
  if ("test" in op) {
    return patchTest(getCtx(obj, op.test), op);
  }
  if ("merge" in op) {
    return patchMerge(getCtx(obj, op.merge), op);
  }

  throw new Error(`Unknown jsonPatchOp: ${JSON.stringify(op)}`);
};

export const jsonPatchApply = (obj: any, ops: JsonPatchOp[]): any => {
  const rootObj = {
    [rootName]: obj,
  };
  for (const op of ops) {
    jsonPatchApplyOp(rootObj, op);
  }
  return rootObj[rootName];
};

const diffPatcher = new DiffPatcher({
  textDiff: {
    minLength: Number.MAX_VALUE,
  }
});
export const getJsonPatchDiff = (from: any, to: any): JsonPatchOp[] => {
  const delta = diffPatcher.diff(from, to);
  const ops: JsonPatchOp[] = [];
  diffDeltaToOp(delta, [], ops);
  return ops;
};

const diffDeltaToOp = (delta: any, path: string[], ops: JsonPatchOp[]) => {
  if (delta === undefined || delta === null) {
    return;
  }
  if (Array.isArray(delta)) {
    if (delta.length === 1) {
      ops.push({ add: jsonPointer.compile(path), value: delta[0] });
      return;
    }
    if (delta.length === 2) {
      ops.push({ replace: jsonPointer.compile(path), value: delta[1] });
      return;
    }
    if (delta.length === 3 && delta[1] === 0 && delta[2] === 0) {
      ops.push({ remove: jsonPointer.compile(path) });
      return;
    };
    throw new Error(`Unknown delta ${JSON.stringify(delta)}`);
  }
  if (delta._t !== "a") {
    for (const key of Object.keys(delta)) {
      diffDeltaToOp(delta[key], path.concat([key]), ops);
    }
  } else {
    for (const key of Object.keys(delta)) {
      if (key[0] === "_") {
        if (key === "_t") {
          continue;
        }
        console.log(`Warning: array diff not supported yet`);
        continue;
      }
      diffDeltaToOp(delta[key], path.concat([key]), ops);
    }
  }
};
