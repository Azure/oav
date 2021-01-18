import { relative as pathRelative, resolve as pathResolve } from "path";
import { readFile as vfsReadFile } from "@azure-tools/openapi-tools-common";
import { getLoaderBuilder, Loader } from "./loader";

export interface FileLoaderOption {
  fileRoot?: string;
}

export class FileLoader implements Loader<string> {
  public static create = getLoaderBuilder((opts: FileLoaderOption) => new FileLoader(opts));
  private constructor(private opts: FileLoaderOption) {
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
      if (!filePath.startsWith(this.opts.fileRoot)) {
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
