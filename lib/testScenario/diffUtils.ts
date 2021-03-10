import { default as stableStringify } from "fast-json-stable-stringify";
import * as jsonPointer from "json-pointer";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
import { compare as jsonPatchCompare } from "fast-json-patch";
import {
  JsonPatchOp,
  JsonPatchOpAdd,
  JsonPatchOpCopy,
  JsonPatchOpMerge,
  JsonPatchOpMove,
  JsonPatchOpReplace,
  JsonPatchOpTest,
} from "./testResourceTypes";

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

export const getJsonPatchDiff = (from: any, to: any): JsonPatchOp[] => {
  const ops = jsonPatchCompare(from, to);
  return ops.map(
    (op): JsonPatchOp => {
      switch (op.op) {
        case "add":
          return { add: op.path, value: op.value };
        case "copy":
          return { copy: op.from, path: op.path };
        case "move":
          return { move: op.from, path: op.path };
        case "remove":
          return { remove: op.path };
        case "replace":
          return { replace: op.path, value: op.value };
        default:
          throw new Error(`Internal error`);
      }
    }
  );
};
