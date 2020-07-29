import { buildRegex } from "../util/path";
import { SwaggerSpec, xmsParameterizedHost, Path, Operation } from "./swaggerTypes";
import { FileSystemJsonLoader } from "./fileSystemJsonLoader";

export class SwaggerValidatorLoader {
  private jsonLoader: FileSystemJsonLoader;

  public constructor(rootFolderPath: string) {
    this.jsonLoader = new FileSystemJsonLoader(rootFolderPath);
  }

  public loadSpec(specFilePath: string): SwaggerSpec {
    const swaggerSpec = (this.jsonLoader.load(specFilePath) as unknown) as SwaggerSpec;

    this.initSwagger(swaggerSpec);

    return swaggerSpec;
  }

  private initSwagger(spec: SwaggerSpec): void {
    // TODO validate swagger

    let basePathPrefix = spec.basePath ?? "";
    if (basePathPrefix.endsWith("/")) {
      basePathPrefix = basePathPrefix.substr(0, basePathPrefix.length - 1);
    }
    const msParameterizedHost = spec[xmsParameterizedHost];
    const hostTemplate = msParameterizedHost?.hostTemplate ?? "";

    for (const pathStr of Object.keys(spec.paths)) {
      const path = spec.paths[pathStr];
      const pathRegex = buildRegex(hostTemplate, basePathPrefix, pathStr);

      for (const method of Object.keys(path)) {
        if (method === "parameter") {
          continue;
        }

        const operation = path[method as keyof Path] as Operation;
        operation._pathRegex = pathRegex;
      }
    }
  }
}
