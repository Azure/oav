import { resolve as pathResolve, dirname } from "path";
import { injectable } from "inversify";
import { Type, YAMLException, load as yamlLoad, DEFAULT_SCHEMA } from "js-yaml";
import { FileLoader } from "../swagger/fileLoader";
import { Loader } from "../swagger/loader";
import { RawScenarioDefinition } from "./apiScenarioTypes";

@injectable()
export class RawTestScenarioLoader implements Loader<RawScenarioDefinition> {
  private fileCache: Map<string, string> = new Map();

  public constructor(private fileLoader: FileLoader) {}

  public async load(filePath: string): Promise<RawScenarioDefinition> {
    const fileContent = await this.fileLoader.load(filePath);
    yamlLoad(fileContent, {
      schema: DEFAULT_SCHEMA.extend(
        new Type("!include", {
          kind: "scalar",
          resolve: (data: any) => {
            if (typeof data === "string") {
              data = data.toLowerCase();
              return (
                data.endsWith(".json") ||
                data.endsWith(".yaml") ||
                data.endsWith(".yml") ||
                data.endsWith(".ps1") ||
                data.endsWith(".sh")
              );
            }
            throw new YAMLException(`unsupported include file: ${data}`);
          },
          construct: (data: string) => {
            this.fileCache.set(data, "");
            return data;
          },
        })
      ),
    });
    for (const file of this.fileCache.keys()) {
      const fileContent = await this.fileLoader.load(pathResolve(dirname(filePath), file));
      this.fileCache.set(file, fileContent);
    }

    const filePayload = yamlLoad(fileContent, {
      schema: DEFAULT_SCHEMA.extend(
        new Type("!include", {
          kind: "scalar",
          construct: (data: string) => this.fileCache.get(data),
        })
      ),
    });

    return filePayload as RawScenarioDefinition;
  }
}
