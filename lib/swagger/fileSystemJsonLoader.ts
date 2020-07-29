import {
  resolve as pathResolve,
  relative as pathRelative,
  dirname as pathDirname,
  join as pathJoin,
} from "path";
import { promisify } from "util";
import { readFile as fsReadFile } from "fs";
import { Json } from "@ts-common/json";
import { readFile as vfsReadFile } from "@ts-common/virtual-fs";
import { parse } from "@ts-common/json-parser";
import { xmsExamples } from "../util/constants";
import { getLazyBuilder } from "../util/lazyBuilder";

const fsReadFileAsync = promisify(fsReadFile);

interface Options {
  useVfs?: boolean;
  useJsonParser?: boolean;
  eraseDescription?: boolean;
  eraseXmsExamples?: boolean;
  keepOriginalContent?: boolean;
  transformRef?: boolean; // TODO implement transformRef: false
}

interface FileCache {
  resolved?: Json;
  filePath: string;
  originalContent?: string;
  mockName: string;
}

export const $id = "id";

export class FileSystemJsonLoader {
  private rootFolder: string;

  private mockNameMap: { [mockName: string]: string } = {};
  private globalMockNameId = 0;

  private loadedFiles: any[] = [];

  private fileCache = new Map<string, FileCache>();
  private loadFile = getLazyBuilder("resolved", async (cache: FileCache) => {
    const absoluteFilePath = pathResolve(this.rootFolder, cache.filePath);
    if (!absoluteFilePath.startsWith(this.rootFolder)) {
      throw new Error(
        `Try to load file "${absoluteFilePath}" outside of root folder ${this.rootFolder}`
      );
    }
    const fileString = this.options.useVfs
      ? await vfsReadFile(absoluteFilePath)
      : (await fsReadFileAsync(absoluteFilePath)).toString();
    if (this.options.keepOriginalContent) {
      // eslint-disable-next-line require-atomic-updates
      cache.originalContent = fileString;
    }
    let fileContent = this.options.useJsonParser
      ? parse(cache.filePath, fileString)
      : JSON.parse(fileString);
    // eslint-disable-next-line require-atomic-updates
    cache.resolved = fileContent;
    (fileContent as any)[$id] = cache.mockName;
    fileContent = await this.resolveRef(fileContent, ["$"], fileContent, cache.filePath);
    this.loadedFiles.push(fileContent);
    return fileContent;
  });

  public constructor(rootFolder: string, private options: Options) {
    this.rootFolder = pathResolve(rootFolder);
  }

  public getLoadedFiles() {
    const loadedFiles = this.loadedFiles;
    this.loadedFiles = [];
    return loadedFiles;
  }

  public async load(inputFilePath: string): Promise<Json> {
    const absoluteFilePath = pathResolve(this.rootFolder, inputFilePath);
    const filePath = pathRelative(this.rootFolder, absoluteFilePath);
    let cache = this.fileCache.get(filePath);
    if (cache === undefined) {
      cache = {
        filePath,
        mockName: this.getNextMockName(filePath),
      };
      this.fileCache.set(filePath, cache);
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
      const mockName = $ref.substr(0, idx);
      const refObjPath = $ref.substr(idx + 1);
      const filePath = this.mockNameMap[mockName];
      const cache = this.fileCache.get(filePath);
      if (cache === undefined) {
        throw new Error(`cache not found for ${filePath}`);
      }

      const pathSegments = refObjPath.split("/");
      if (pathSegments[0] !== "") {
        throw new Error("ref format error");
      }

      refObj = cache.resolved as any;
      for (let idx = 1; idx < pathSegments.length; ++idx) {
        refObj = (refObj as any)[pathSegments[idx]];
        if (refObj === null || refObj === undefined) {
          throw new Error(`Failed while resolving ref obj ${refObjPath}`);
        }
      }

      (object as any).$ref = $ref;
    }

    return refObj;
  }

  private async resolveRef(
    object: Json,
    pathArr: string[],
    rootObject: Json,
    relativeFilePath: string
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
        const mockName = (rootObject as any)[$id];
        return { $ref: `${mockName}#${refObjPath}` };
      }
      const refObj = await this.load(pathJoin(pathDirname(relativeFilePath), refFilePath));
      const refMockName = (refObj as any)[$id];
      return { $ref: `${refMockName}#${refObjPath}` };
    }

    if (Array.isArray(object)) {
      for (let idx = 0; idx < object.length; ++idx) {
        const item = object[idx];
        if (typeof item === "object" && item !== null) {
          const newRef = await this.resolveRef(
            item,
            pathArr.concat([idx.toString()]),
            rootObject,
            relativeFilePath
          );
          if (newRef !== item) {
            // eslint-disable-next-line require-atomic-updates
            object[idx] = newRef;
          }
        }
      }
    } else if (typeof object === "object" && object !== null) {
      const obj = object as any;
      if (this.options.eraseDescription && typeof obj.description === "string") {
        delete obj.description;
      }
      if (this.options.eraseXmsExamples && obj[xmsExamples] !== undefined) {
        delete obj[xmsExamples];
      }

      for (const key of Object.keys(obj)) {
        const item = obj[key];
        if (typeof item === "object" && item !== null) {
          const newRef = await this.resolveRef(
            item,
            pathArr.concat([key]),
            rootObject,
            relativeFilePath
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
