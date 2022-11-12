import { dirname as pathDirname } from "path";
import {
  FilePosition,
  getInfo,
  getRootObjectInfo,
  Json,
  parseJson,
  pathJoin,
  readFile as vfsReadFile,
} from "@azure-tools/openapi-tools-common";
import $RefParser, { FileInfo } from "@apidevtools/json-schema-ref-parser";
import { load as parseYaml } from "js-yaml";
import { default as jsonPointer } from "json-pointer";
import { inject, injectable } from "inversify";
import { xmsExamples } from "../util/constants";
import { getLazyBuilder } from "../util/lazyBuilder";
import { TYPES } from "../inversifyUtils";
import { FileLoader, FileLoaderOption } from "./fileLoader";
import { Loader, setDefaultOpts } from "./loader";

export interface JsonLoaderOption extends FileLoaderOption {
  useJsonParser?: boolean;
  eraseDescription?: boolean;
  eraseXmsExamples?: boolean;
  keepOriginalContent?: boolean;
  transformRef?: boolean; // TODO implement transformRef: false
  skipResolveRefKeys?: string[];
  supportYaml?: boolean;
  shouldResolveRef?: boolean;
}

interface FileCache {
  resolved?: Json;
  filePath: string;
  originalContent?: string;
  skipResolveRef?: boolean;
  mockName: string;
  resolveRef?: boolean;
}

export const $id = "$id";

export class JsonLoaderRefError extends Error {
  public position?: FilePosition;
  public url?: string;
  public ref?: string;

  public constructor(source: { $ref: string }) {
    super(`Failed to resolve ref for ${source.$ref}`);
    const info = getInfo(source);
    if (info !== undefined) {
      const rootInfo = getRootObjectInfo(info);
      this.position = info.position;
      this.url = rootInfo.url;
      this.ref = source.$ref;
    }
  }
}

@injectable()
export class JsonLoader implements Loader<Json> {
  private mockNameMap: { [mockName: string]: string } = {};
  private globalMockNameId = 0;

  private loadedFiles: any[] = [];
  private skipResolveRefKeys: Set<string>;

  private fileCache = new Map<string, FileCache>();
  private loadFile = getLazyBuilder("resolved", async (cache: FileCache) => {
    const fileString = await this.fileLoader.load(cache.filePath);
    if (this.opts.keepOriginalContent || cache.resolveRef) {
      // eslint-disable-next-line require-atomic-updates
      cache.originalContent = fileString;
    }
    let fileContent = this.parseFileContent(cache, fileString);
    // eslint-disable-next-line require-atomic-updates
    cache.resolved = fileContent;
    (fileContent as any)[$id] = cache.mockName;
    if (cache.skipResolveRef !== true) {
      fileContent = await this.resolveRef(fileContent, ["$"], fileContent, cache.filePath, false);
    }
    this.loadedFiles.push(fileContent);
    return fileContent;
  });

  private loadAndResolveFile = getLazyBuilder("resolved", async (cache: FileCache) => {
    const fileString = await this.fileLoader.load(cache.filePath);
    if (this.opts.keepOriginalContent || cache.resolveRef) {
      // eslint-disable-next-line require-atomic-updates
      cache.originalContent = fileString;
    }
    //get unresolved content from cache.originalContent
    let fileContent = this.parseFileContent(cache, fileString);
    // try to bundle and deference swagger, but ignore circular defination
    // remove unnecessary properties
    removeProperty(fileContent);
    // eslint-disable-next-line require-atomic-updates
    //resolve all refs using lib: https://github.com/APIDevTools/json-schema-ref-parser
    const resolveOption: $RefParser.Options = {
      resolve: {
        file: {
          canRead: true,
          read(file: FileInfo) {
            if (isExample(file.url)) {
              return {};
            }
            return loadSingleFile(file.url);
          },
        },
      },
      dereference: {
        circular: "ignore",
      },
    };
    try {
      const parser = new $RefParser();
      if (cache.filePath.includes("analyz")) {
        console.log(cache.filePath);
      }
      let spec = await parser.bundle(
        this.fileLoader.resolvePath(cache.filePath),
        fileContent,
        resolveOption
      );
      spec = await parser.dereference(
        this.fileLoader.resolvePath(cache.filePath),
        fileContent,
        resolveOption
      );
      fileContent = spec;
    } catch (err) {
      throw `Failed to dereference swagger ${cache.filePath} err: ${JSON.stringify(err)}`; 
    }
    cache.resolved = fileContent;
    (fileContent as any)[$id] = cache.mockName;
    if (cache.skipResolveRef !== true) {
      fileContent = await this.resolveBundledRef(fileContent, ["$"], fileContent, cache.filePath, false);
    }
    this.loadedFiles.push(fileContent);
    return fileContent;
  });

  public constructor(
    @inject(TYPES.opts) private opts: JsonLoaderOption,
    private fileLoader: FileLoader
  ) {
    setDefaultOpts(opts, {
      useJsonParser: true,
      eraseDescription: true,
      eraseXmsExamples: true,
      transformRef: true,
      supportYaml: false,
    });
    this.skipResolveRefKeys = new Set(opts.skipResolveRefKeys);
  }

  private parseFileContent(cache: FileCache, fileString: string): any {
    if (
      this.opts.supportYaml &&
      (cache.filePath.endsWith(".yaml") || cache.filePath.endsWith(".yml"))
    ) {
      return parseYaml(fileString, {
        filename: cache.filePath,
        json: true,
      });
    }

    return this.opts.useJsonParser ? parseJson(cache.filePath, fileString) : JSON.parse(fileString);

    // throw new Error(`Unknown file format while loading file ${cache.filePath}`);
  }

  public async load(inputFilePath: string, skipResolveRef?: boolean): Promise<Json> {
    const filePath = this.fileLoader.relativePath(inputFilePath);
    let cache = this.fileCache.get(filePath);
    if (cache === undefined) {
      cache = {
        filePath,
        mockName: this.getNextMockName(filePath),
      };
      this.fileCache.set(filePath, cache);
    }
    if (skipResolveRef !== undefined) {
      cache.skipResolveRef = skipResolveRef;
    }

    if (this.opts.shouldResolveRef) {
      cache.resolveRef = this.opts.shouldResolveRef;
      await this.loadFile(cache);
      
    }
    return this.loadFile(cache);
  }

  public getFileContentFromCache(filePath: string): Json | undefined {
    if (this.fileCache !== undefined) {
      const cache = this.fileCache.get(filePath);
      return cache?.resolved;
    }
    return undefined;
  }

  public async resolveFile(mockName: string): Promise<any> {
    const filePath = this.mockNameMap[mockName];
    let cache = this.fileCache.get(filePath);
    if (cache !== undefined) {
      return this.loadFile(cache);
    }

    // Fallback for load file outside our swagger context
    const contentString = await this.fileLoader.load(mockName);
    cache = {
      filePath: mockName,
      mockName,
    };
    const content = this.parseFileContent(cache, contentString);
    return content;
  }

  public resolveRefObj<T>(object: T): T {
    let refObj = object;

    while (isRefLike(refObj)) {
      const $ref = refObj.$ref;
      const idx = $ref.indexOf("#");
      const mockName = idx === -1 ? $ref : $ref.substr(0, idx);
      const refObjPath = idx === -1 ? "" : $ref.substr(idx + 1);
      const filePath = this.mockNameMap[mockName];
      const cache = this.fileCache.get(filePath);
      if (cache === undefined) {
        throw new Error(`cache not found for ${filePath}`);
      }

      refObj = jsonPointer.get(cache.resolved! as any, refObjPath);
      (object as any).$ref = $ref;
    }

    return refObj;
  }

  public resolveMockedFile(fileName: string): any {
    let refObj;
    if (!!fileName && fileName.startsWith("_")) {
      const filePath = this.mockNameMap[fileName];
      const cache = this.fileCache.get(filePath);
      if (cache === undefined) {
        throw new Error(`cache not found for ${filePath} and mockName ${fileName}`);
      }

      refObj = jsonPointer.get(cache.resolved! as any, "");
    }
    return refObj;
  }

  public getRealPath(mockName: string): string {
    return this.mockNameMap[mockName];
  }

  private resolveInnerRef(object: Json, refObjPath: string, rootObject: Json): string | undefined {
    const refObjPathSegs = refObjPath.split("/");
    const refSegs = [];
    let refPath = refObjPath;
    if (typeof rootObject !== "object" || rootObject === null) {
      return undefined;
    }
    if (isRefLike(object)) {
      // should find subObject with the Ref_Json_Path
      while (refObjPathSegs.length > 0) {
        if (!jsonPointer.has(object as {}, refPath)) {
          refSegs.push(refObjPathSegs.pop());
          refPath = refObjPathSegs.join("/");
          continue;
        }
        // find refPath in object and try to find path_b in subObject
        const path_b = refSegs.reverse().join("/");
        const innerPath = this.resolveInnerRef(jsonPointer.get(object, refPath), path_b, rootObject);
        if (innerPath !== undefined) {
          if (innerPath.startsWith("#")) {
            return innerPath
          }
          return `${refObjPath}/${innerPath}`;
        } else {
          throw new Error(`Invalid sub jsonPath in Reflike sub Obj ${path_b}`);
        }
      }
      const path_b = refSegs.reverse().join("/");
      const innerPath = this.resolveInnerRef(jsonPointer.get(rootObject, object.$ref), path_b, rootObject);
      if (innerPath !== undefined) {
        if (innerPath.startsWith("#")) {
          return innerPath
        }
        return `${refObjPath}/${innerPath}`;
      } else {
        throw new Error(`Invalid sub jsonPath in Reflike ${path_b}`);
      }
    } else if (typeof object === "object" && object !== null) {
      // json object without ref
      if (!jsonPointer.has(object as {}, refObjPath)) {
        throw new Error(`Invalid jsonPath in obj ${refObjPath}`);
      } else {
        return refObjPath;
      }
    } else if (Array.isArray(object)) {
      // DO SOMETHING HERE!!!!
      for (let idx = 0; idx < object.length; ++idx) {
        const item = object[idx];
        if (typeof item === "object" && item !== null) {
          const newRef = await this.resolveInnerRef(
            item,
            refObjPath,
            rootObject
          );
          if (newRef !== undefined) {
            return ??//DO SOMETHING HERE!!!
          }
        }
      }
      throw new Error(`Invalid jsonPath in array ${refObjPath}`);
    }
  }

  private async resolveBundledRef(
    object: Json,
    pathArr: string[],
    rootObject: Json,
    relativeFilePath: string,
    skipResolveChildRef: boolean
  ): Promise<Json> {
    if (isRefLike(object)) {
      const ref = object.$ref;
      const sp = ref.split("#");
      if (sp.length > 2) {
        throw new Error("ref format error multiple #");
      }

      const [refFilePath, refObjPath] = sp;
      let newRefPath = undefined;
      if (refFilePath === "") {
        // Local reference
        if (!jsonPointer.has(rootObject as {}, refObjPath)) {
          //DO SOMETHING HERE!!!!!!!! UPDATE refObjPath
          newRefPath = this.resolveInnerRef(rootObject, refObjPath, rootObject);
          if (newRefPath === undefined) {
            throw new JsonLoaderRefError(object);
          }
          const mockName = (rootObject as any)[$id];
          return { $ref: `${mockName}#${newRefPath}` };
        }
        const mockName = (rootObject as any)[$id];
        return { $ref: `${mockName}#${refObjPath}` };
      } else {
        throw new Error(`Encounter outer ref when resolve bundled spec: ${refFilePath}`);
      }
    }

    if (Array.isArray(object)) {
      for (let idx = 0; idx < object.length; ++idx) {
        const item = object[idx];
        if (typeof item === "object" && item !== null) {
          const newRef = await this.resolveBundledRef(
            item,
            pathArr.concat([idx.toString()]),
            rootObject,
            relativeFilePath,
            skipResolveChildRef
          );
          if (newRef !== item) {
            // eslint-disable-next-line require-atomic-updates
            (object as any)[idx] = newRef;
          }
        }
      }
    } else if (typeof object === "object" && object !== null) {
      const obj = object as any;
      if (this.opts.eraseDescription && typeof obj.description === "string") {
        delete obj.description;
      }
      if (this.opts.eraseXmsExamples && obj[xmsExamples] !== undefined) {
        delete obj[xmsExamples];
      }

      for (const key of Object.keys(obj)) {
        const item = obj[key];
        if (typeof item === "object" && item !== null) {
          const newRef = await this.resolveBundledRef(
            item,
            pathArr.concat([key]),
            rootObject,
            relativeFilePath,
            skipResolveChildRef || this.skipResolveRefKeys.has(key)
          );
          if (newRef !== item) {
            obj[key] = newRef;
          }
        }
      }
    } else {
      throw new Error("Invalid json");
    }

    return object;
  }

  private async resolveRef(
    object: Json,
    pathArr: string[],
    rootObject: Json,
    relativeFilePath: string,
    skipResolveChildRef: boolean
  ): Promise<Json> {
    if (isRefLike(object)) {
      const ref = object.$ref;
      const sp = ref.split("#");
      if (sp.length > 2) {
        throw new Error("ref format error multiple #");
      }

      const [refFilePath, refObjPath] = sp;
      if (refFilePath === "") {
        // Local reference
        if (!jsonPointer.has(rootObject as {}, refObjPath)) {
          throw new JsonLoaderRefError(object);
        }
        const mockName = (rootObject as any)[$id];
        return { $ref: `${mockName}#${refObjPath}` };
      }
      const refObj = await this.load(
        pathJoin(pathDirname(relativeFilePath), refFilePath),
        skipResolveChildRef
      );
      const refMockName = (refObj as any)[$id];
      if (refObjPath !== undefined) {
        if (!jsonPointer.has(refObj as {}, refObjPath)) {
          throw new JsonLoaderRefError(object);
        }
        return { $ref: `${refMockName}#${refObjPath}` };
      } else {
        return { $ref: refMockName };
      }
    }

    if (Array.isArray(object)) {
      for (let idx = 0; idx < object.length; ++idx) {
        const item = object[idx];
        if (typeof item === "object" && item !== null) {
          const newRef = await this.resolveRef(
            item,
            pathArr.concat([idx.toString()]),
            rootObject,
            relativeFilePath,
            skipResolveChildRef
          );
          if (newRef !== item) {
            // eslint-disable-next-line require-atomic-updates
            (object as any)[idx] = newRef;
          }
        }
      }
    } else if (typeof object === "object" && object !== null) {
      const obj = object as any;
      if (this.opts.eraseDescription && typeof obj.description === "string") {
        delete obj.description;
      }
      if (this.opts.eraseXmsExamples && obj[xmsExamples] !== undefined) {
        delete obj[xmsExamples];
      }

      for (const key of Object.keys(obj)) {
        const item = obj[key];
        if (typeof item === "object" && item !== null) {
          const newRef = await this.resolveRef(
            item,
            pathArr.concat([key]),
            rootObject,
            relativeFilePath,
            skipResolveChildRef || this.skipResolveRefKeys.has(key)
          );
          if (newRef !== item) {
            obj[key] = newRef;
          }
        }
      }
    } else {
      throw new Error("Invalid json");
    }

    return object;
  }

  private getNextMockName(filePath: string) {
    const id = this.globalMockNameId++;
    const mockName = `_${id.toString(36)}`;
    this.mockNameMap[mockName] = filePath;
    return mockName;
  }
}

export const isRefLike = (obj: any): obj is { $ref: string } => typeof obj.$ref === "string";

export function isExample(path: string) {
  return path.split(/\\|\//g).includes("examples");
}

export async function loadSingleFile(filePath: string) {
  const fileString = await vfsReadFile(filePath);
  return JSON.parse(fileString);
}

export function removeProperty(object: any) {
  // opt: eraseXmsExamples: true can be used to remove examples or other properties in schema,
  // however, this is implemented in function resolveRef, which cannot be reused, since it does not
  // completely resolve all the reference in swagger.
  // Only description and example are positive to be removed, other properties are kept for further use.
  if (typeof object === "object" && object !== null) {
    const obj = object as any;
    if (typeof obj.description === "string") {
      delete obj.description;
    }
    if (obj[xmsExamples] !== undefined) {
      delete obj[xmsExamples];
    }
    Object.keys(object).forEach((o) => {
      removeProperty(object[o]);
    });
  }
}
