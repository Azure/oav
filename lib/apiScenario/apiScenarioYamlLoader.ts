import { resolve as pathResolve, dirname } from "path";
import { injectable } from "inversify";
import { Type, YAMLException, load as yamlLoad, DEFAULT_SCHEMA } from "js-yaml";
import { default as AjvInit, ValidateFunction } from "ajv";
import { Loader } from "../swagger/loader";
import { FileLoader } from "../swagger/fileLoader";
import { RawScenarioDefinition } from "./apiScenarioTypes";
import { ApiScenarioDefinition } from "./apiScenarioSchema";

const ajv = new AjvInit({
  useDefaults: true,
});
@injectable()
export class ApiScenarioYamlLoader implements Loader<RawScenarioDefinition> {
  private fileCache: Map<string, string> = new Map();
  private validateApiScenarioFile: ValidateFunction;

  public constructor(private fileLoader: FileLoader) {
    this.validateApiScenarioFile = ajv.compile(ApiScenarioDefinition);
  }

  public async load(filePath: string): Promise<RawScenarioDefinition> {
    this.fileCache.clear();

    const fileContent = await this.fileLoader.load(filePath);
    yamlLoad(fileContent, {
      schema: DEFAULT_SCHEMA.extend(
        new Type("!include", {
          kind: "scalar",
          resolve: (data: any) => {
            if (typeof data === "string") {
              data = data.toLowerCase();
              if (data.endsWith(".ps1") || data.endsWith(".sh")) {
                return true;
              }
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

    if (!this.validateApiScenarioFile(filePayload)) {
      const err = this.validateApiScenarioFile.errors![0];
      throw new Error(
        `Failed to validate test resource file ${filePath}: ${err.dataPath} ${err.message}`
      );
    }

    return filePayload as RawScenarioDefinition;
  }
}
