import { readFileSync } from "fs";
import {
  resolve as pathResolve,
  relative as pathRelative,
  dirname as pathDirname,
  join as pathJoin,
} from "path";
import { Json } from "@ts-common/json";
import { parse } from "@ts-common/json-parser";

export class FileSystemJsonLoader {
  private fileCache: { [filePath: string]: Json } = {};

  public constructor(public readonly rootFolder: string) {}

  public load(inputFilePath: string): Json {
    const absoluteFilePath = pathResolve(this.rootFolder, inputFilePath);
    const filePath = pathRelative(this.rootFolder, absoluteFilePath);
    const result = this.fileCache[filePath];
    if (result !== undefined) {
      return result;
    }

    const fileString = readFileSync(absoluteFilePath).toString();
    // const fileContent = JSON.parse(fileString);
    const fileContent = parse(filePath, fileString);
    this.fileCache[filePath] = fileContent;
    this.resolveRef(fileContent, fileContent, filePath);

    return fileContent;
  }

  private resolveRef(object: Json, rootObject: Json, relativeFilePath: string): Json {
    if (isRefLike(object)) {
      const ref = object.$ref;
      const sp = ref.split("#");
      if (sp.length > 2) {
        throw new Error("ref format error multiple #");
      }

      const [refFilePath, refObjPath] = sp;
      let refObj: Json =
        refFilePath === ""
          ? rootObject
          : this.load(pathJoin(pathDirname(relativeFilePath), refFilePath));
      if (refObjPath === undefined) {
        return refObj;
      }
      const pathSegments = refObjPath.split("/");
      if (pathSegments[0] !== "") {
        throw new Error("ref format error");
      }

      for (let idx = 1; idx < pathSegments.length; ++idx) {
        refObj = (refObj as any)[pathSegments[idx]];
        if (refObj === null || refObj === undefined) {
          throw new Error(`Failed while resolving ref obj ${relativeFilePath} ${refObjPath}`);
        }
      }

      return refObj;
    }

    if (Array.isArray(object)) {
      let idx = 0;
      for (const item of object) {
        if (typeof item === "object" && item !== null) {
          const newRef = this.resolveRef(item, rootObject, relativeFilePath);
          if (newRef !== item) {
            object[idx] = newRef;
          }
        }
        idx++;
      }
    } else if (typeof object === "object") {
      for (const key of Object.keys(object as any)) {
        const item = (object as any)[key];
        if (typeof item === "object" && item !== null) {
          const newRef = this.resolveRef(item, rootObject, relativeFilePath);
          if (newRef !== item) {
            (object as any)[key] = newRef;
          }
        }
      }
    } else {
      throw new Error("Invalid json");
    }

    return object;
  }
}

const isRefLike = (obj: any): obj is { $ref: string } => typeof obj.$ref === "string";
