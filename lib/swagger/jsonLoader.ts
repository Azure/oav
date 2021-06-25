import { dirname as pathDirname, join as pathJoin } from "path";
import { Json, parseJson } from "@azure-tools/openapi-tools-common";
import { safeLoad as parseYaml } from "js-yaml";
import { default as jsonPointer } from "json-pointer";
import { inject, injectable } from "inversify";
import { default as stableStringify } from "fast-json-stable-stringify";
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
}

interface FileCache {
  resolved?: Json;
  filePath: string;
  originalContent?: string;
  skipResolveRef?: boolean;
  mockName: string;
}

export const $id = "$id";
const modelCacheMockName = "_";

@injectable()
export class JsonLoader implements Loader<Json> {
  private mockNameMap: { [mockName: string]: string } = {};
  private modelCache: { [$id]: string; definitions: { [modelName: string]: any } } = {
    [$id]: modelCacheMockName,
    definitions: {},
  };
  private modelStringifyToModelCacheKey = new Map<string, string>();
  private modelToCacheKey = new Map<any, string>();
  private globalModelCacheKeyId = 0;
  private globalMockNameId = 0;

  private loadedFiles: any[] = [];
  private skipResolveRefKeys: Set<string>;

  private fileCache = new Map<string, FileCache>();
  private loadFile = getLazyBuilder("resolved", async (cache: FileCache) => {
    const fileString = await this.fileLoader.load(cache.filePath);
    if (this.opts.keepOriginalContent) {
      // eslint-disable-next-line require-atomic-updates
      cache.originalContent = fileString;
    }
    let fileContent = this.parseFileContent(cache, fileString);
    // eslint-disable-next-line require-atomic-updates
    cache.resolved = fileContent;
    (fileContent as any)[$id] = cache.mockName;
    if (cache.skipResolveRef !== true) {
      fileContent = await this.resolveRef(fileContent, ["$"], fileContent, cache, false);
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
    this.modelCache[$id] = modelCacheMockName;
    this.mockNameMap[modelCacheMockName] = modelCacheMockName;
    this.fileCache.set(modelCacheMockName, {
      filePath: modelCacheMockName,
      mockName: modelCacheMockName,
      resolved: this.modelCache,
    });
  }

  private parseFileContent(cache: FileCache, fileString: string): any {
    if (cache.filePath.endsWith(".json")) {
      return this.opts.useJsonParser
        ? parseJson(cache.filePath, fileString)
        : JSON.parse(fileString);
    }

    if (
      this.opts.supportYaml &&
      (cache.filePath.endsWith(".yaml") || cache.filePath.endsWith(".yml"))
    ) {
      return parseYaml(fileString, {
        filename: cache.filePath,
        json: true,
      });
    }

    throw new Error(`Unknown file format while loading file ${cache.filePath}`);
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
    return this.loadFile(cache);
  }

  public async resolveFile(mockName: string): Promise<any> {
    const filePath = this.mockNameMap[mockName];
    const cache = this.fileCache.get(filePath);
    return this.loadFile(cache!);
  }

  public resolveRefObj<T>(object: T): T {
    if (object === undefined) {
      return object;
    }
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

      refObj = jsonPointer.get(cache.resolved!, refObjPath);
      (object as any).$ref = $ref;
    }

    return refObj;
  }

  public getRealPath(mockName: string): string {
    return this.mockNameMap[mockName];
  }

  private async resolveRefLike(
    object: { $ref: string },
    rootObject: Json,
    fileCache: FileCache,
    skipResolveChildRef: boolean
  ): Promise<{ $ref: string; referredObj?: any }> {
    const ref = object.$ref;
    const sp = ref.split("#");
    if (sp.length > 2) {
      throw new Error("ref format error multiple #");
    }

    const [refFilePath, refObjPath] = sp;
    if (refFilePath === "") {
      // Local reference
      const referredObj = jsonPointer.get(rootObject as {}, refObjPath);
      const mockName = (rootObject as any)[$id];
      return { $ref: `${mockName}#${refObjPath}`, referredObj };
    }
    const refObj = await this.load(
      pathJoin(pathDirname(fileCache.filePath), refFilePath),
      skipResolveChildRef
    );
    const refMockName = (refObj as any)[$id];
    if (refObjPath !== undefined) {
      const referredObj = jsonPointer.get(refObj as {}, refObjPath);
      return { $ref: `${refMockName}#${refObjPath}`, referredObj };
    } else {
      return { $ref: refMockName };
    }
  }

  private async resolveRef(
    object: Json,
    pathArr: string[],
    rootObject: Json,
    fileCache: FileCache,
    skipResolveChildRef: boolean
  ): Promise<Json> {
    if (isRefLike(object)) {
      const { $ref } = await this.resolveRefLike(
        object,
        rootObject,
        fileCache,
        skipResolveChildRef
      );
      return { $ref };
      // }
      // const modelCacheKey = this.getModelCacheKey(referredObj);
      // return { $ref: `${modelCacheMockName}#/definitions/${modelCacheKey}` };
    }

    if (Array.isArray(object)) {
      for (let idx = 0; idx < object.length; ++idx) {
        const item = object[idx];
        if (typeof item === "object" && item !== null) {
          const newRef = await this.resolveRef(
            item,
            pathArr.concat([idx.toString()]),
            rootObject,
            fileCache,
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
            fileCache,
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

  public preserveModelCacheKey(model: any) {
    const id = this.globalModelCacheKeyId++;
    const cacheKey = id.toString(36);
    this.modelCache.definitions[cacheKey] = model;
    return cacheKey;
  }

  public getModelCacheKey(model: any) {
    let cacheKey = this.modelToCacheKey.get(model);
    if (cacheKey !== undefined) {
      return cacheKey;
    }

    const modelStringify = stableStringify(model);
    cacheKey = this.modelStringifyToModelCacheKey.get(modelStringify);
    if (cacheKey !== undefined) {
      this.modelToCacheKey.set(model, cacheKey);
      return cacheKey;
    }

    cacheKey = this.preserveModelCacheKey(model);
    this.modelToCacheKey.set(model, cacheKey);
    this.modelStringifyToModelCacheKey.set(modelStringify, cacheKey);
    return cacheKey;
  }

  public refObjToModelCache(cacheKey: string) {
    return { $ref: `${modelCacheMockName}#/definitions/${cacheKey}` };
  }
}

export const isRefLike = (obj: any): obj is { $ref: string } => typeof obj.$ref === "string";
