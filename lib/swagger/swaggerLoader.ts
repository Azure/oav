import { inject, injectable } from "inversify";
import { TYPES } from "../util/constants";
import { FileLoader } from "./fileLoader";
import { JsonLoader } from "./jsonLoader";
import { Loader, setDefaultOpts } from "./loader";
import { SuppressionLoader } from "./suppressionLoader";
import { SwaggerSpec } from "./swaggerTypes";

export interface SwaggerLoaderOption {
  setFilePath?: boolean;
}

@injectable()
export class SwaggerLoader implements Loader<SwaggerSpec> {
  private constructor(
    @inject(TYPES.opts) private opts: SwaggerLoaderOption,
    private suppressionLoader: SuppressionLoader,
    private jsonLoader: JsonLoader,
    private fileLoader: FileLoader
  ) {
    setDefaultOpts(opts, {
      setFilePath: true,
    });
  }

  // TODO reportError
  public async load(specFilePath: string): Promise<SwaggerSpec> {
    const swaggerSpec = (await (this.jsonLoader.load(specFilePath) as unknown)) as SwaggerSpec;

    if (this.opts.setFilePath) {
      swaggerSpec._filePath = this.fileLoader.relativePath(specFilePath);
    }

    await this.suppressionLoader.load(swaggerSpec);

    return swaggerSpec;
  }
}
