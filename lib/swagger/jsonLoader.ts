import { dirname as pathDirname, join as pathJoin } from "path";
import { Json, parseJson } from "@azure-tools/openapi-tools-common";
import { safeLoad as parseYaml } from "js-yaml";
import { default as jsonPointer } from "json-pointer";
import { xmsExamples } from "../util/constants";
import { getLazyBuilder } from "../util/lazyBuilder";
import { FileLoader, FileLoaderOption } from "./fileLoader";
import { getLoaderBuilder, Loader, setDefaultOpts } from "./loader";

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

export const $id = "id";

export class JsonLoader implements Loader<Json> {
  private fileLoader: FileLoader;

  private mockNameMap: { [mockName: string]: string } = {};
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
      fileContent = await this.resolveRef(fileContent, ["$"], fileContent, cache.filePath, false);
    }
    this.loadedFiles.push(fileContent);
    return fileContent;
  });

  public static create = getLoaderBuilder((opts: JsonLoaderOption) => new JsonLoader(opts));
  private constructor(private opts: JsonLoaderOption) {
    setDefaultOpts(opts, {
      useJsonParser: true,
      eraseDescription: true,
      eraseXmsExamples: true,
      transformRef: true,
      supportYaml: false,
    });
    this.skipResolveRefKeys = new Set(opts.skipResolveRefKeys);
    this.fileLoader = FileLoader.create(opts);
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
        jsonPointer.get(rootObject as {}, refObjPath);
        const mockName = (rootObject as any)[$id];
        return { $ref: `${mockName}#${refObjPath}` };
      }
      const refObj = await this.load(
        pathJoin(pathDirname(relativeFilePath), refFilePath),
        skipResolveChildRef
      );
      const refMockName = (refObj as any)[$id];
      if (refObjPath !== undefined) {
        jsonPointer.get(refObj as {}, refObjPath);
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
