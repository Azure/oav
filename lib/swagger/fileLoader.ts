import { relative as pathRelative, resolve as pathResolve } from "path";
import { readFile as vfsReadFile } from "@azure-tools/openapi-tools-common";
import { inject, injectable } from "inversify";
import { TYPES } from "../inversifyUtils";
import { Loader, setDefaultOpts } from "./loader";

export interface FileLoaderOption {
  fileRoot?: string;
  checkUnderFileRoot?: boolean;
}

@injectable()
export class FileLoader implements Loader<string> {
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
    return vfsReadFile(filePath);
  }

  public relativePath(filePath: string) {
    if (this.opts.fileRoot) {
      filePath = this.resolvePath(filePath);
      filePath = pathRelative(this.opts.fileRoot, filePath);
    }
    return filePath;
  }

  public resolvePath(filePath: string) {
    if (this.opts.fileRoot) {
      // TODO handle http url file
      filePath = pathResolve(this.opts.fileRoot, filePath);
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
    filePath = pathResolve(this.opts.fileRoot, filePath);
    return filePath.startsWith(this.opts.fileRoot);
  }
}
