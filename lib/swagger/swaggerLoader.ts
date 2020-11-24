import { FileLoader } from "./fileLoader";
import { JsonLoader, JsonLoaderOption } from "./jsonLoader";
import { getLoaderBuilder, Loader, setDefaultOpts } from "./loader";
import { SuppressionLoader, SuppressionLoaderOption } from "./suppressionLoader";
import { SwaggerSpec } from "./swaggerTypes";

export interface SwaggerLoaderOption extends SuppressionLoaderOption, JsonLoaderOption {
  setFilePath?: boolean;
}

export class SwaggerLoader implements Loader<SwaggerSpec> {
  private suppressionLoader: SuppressionLoader;
  private jsonLoader: JsonLoader;
  private fileLoader: FileLoader;

  public static create = getLoaderBuilder((opts: SwaggerLoaderOption) => new SwaggerLoader(opts));

  private constructor(private opts: SwaggerLoaderOption) {
    setDefaultOpts(opts, {
      setFilePath: true,
    });

    this.jsonLoader = JsonLoader.create(opts);
    this.suppressionLoader = SuppressionLoader.create(opts);
    this.fileLoader = FileLoader.create(opts);
  }

  // TODO reportError
  public async load(specFilePath: string): Promise<SwaggerSpec> {
    const swaggerSpec = (await (this.jsonLoader.load(specFilePath) as unknown)) as SwaggerSpec;

    if (this.opts.setFilePath) {
      swaggerSpec._filePath = this.fileLoader.relativePath(specFilePath);
    }

    if (this.opts.loadSuppression) {
      await this.suppressionLoader.load(swaggerSpec);
    }

    return swaggerSpec;
  }
}
