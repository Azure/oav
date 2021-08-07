import { dirname, relative as pathRelative, resolve as pathResolveOrigin } from "path";
import {
  asyncWriteFile,
  readFile as vfsReadFile,
  pathJoin,
  pathResolve,
  urlParse,
} from "@azure-tools/openapi-tools-common";
import * as fs from "fs-extra";
import { inject, injectable } from "inversify";
import mkdirp from "mkdirp";
import { TYPES } from "../inversifyUtils";
import { Loader, setDefaultOpts } from "./loader";

export interface FileLoaderOption {
  fileRoot?: string;
  checkUnderFileRoot?: boolean;
}

@injectable()
export class FileLoader implements Loader<string> {
  private preloadCache = new Map<string, string>();

  public constructor(@inject(TYPES.opts) private opts: FileLoaderOption) {
    setDefaultOpts(opts, {
      checkUnderFileRoot: true,
    });

    if (this.opts.fileRoot) {
      this.opts.fileRoot = pathResolve(this.opts.fileRoot);
    }
  }

  public async load(filePath: string) {
    filePath = this.resolvePath(filePath);

    const preloadContent = this.preloadCache.get(filePath);
    if (preloadContent !== undefined) {
      return preloadContent;
    }

    return vfsReadFile(filePath);
  }

  public relativePath(filePath: string) {
    if (this.opts.fileRoot) {
      filePath = this.resolvePath(filePath);
      const url = urlParse(filePath);
      if (url === undefined) {
        filePath = pathRelative(this.opts.fileRoot, filePath);
      } else {
        const rootUrl = urlParse(this.opts.fileRoot);
        filePath = rootUrl === undefined ? filePath : pathRelative(rootUrl.path, url.path);
      }
    }
    return filePath;
  }

  public resolvePath(filePath: string) {
    if (this.opts.fileRoot) {
      filePath =
        urlParse(filePath) !== undefined
          ? filePath
          : pathResolveOrigin(this.opts.fileRoot, filePath);
      if (this.opts.checkUnderFileRoot && !filePath.startsWith(this.opts.fileRoot)) {
        throw new Error(
          `Try to load file "${filePath}" outside of root folder ${this.opts.fileRoot}`
        );
      }
    }
    return filePath;
  }

  public isUnderFileRoot(filePath: string) {
    if (!this.opts.fileRoot) {
      return true;
    }
    filePath = pathJoin(this.opts.fileRoot, filePath);
    return filePath.startsWith(this.opts.fileRoot);
  }

  public async writeFile(filePath: string, content: string) {
    filePath = this.resolvePath(filePath);
    await mkdirp(dirname(filePath));
    return asyncWriteFile(filePath, content);
  }

  public async appendFile(filePath: string, content: string) {
    filePath = this.resolvePath(filePath);
    await fs.appendFile(filePath, content);
  }

  public preloadExtraFile(filePath: string, content: string) {
    this.preloadCache.set(filePath, content);
  }
}
