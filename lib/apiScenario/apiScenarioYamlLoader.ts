import * as fs from "fs";
import { resolve as pathResolve, dirname } from "path";
import { JSONPath } from "jsonpath-plus";
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

const getAllSwaggerFilePathUnderDir = (dir: string): any[] => {
  const allSwaggerFiles = fs
    .readdirSync(dir)
    .map((it) => pathResolve(dir, it))
    .filter((it) => it.endsWith(".json"));
  return allSwaggerFiles;
};

export const getSwaggerFilePathsFromApiScenarioFilePath = (
  apiScenarioFilePath: string
): string[] => {
  const fileContent = fs.readFileSync(apiScenarioFilePath).toString();
  const rawScenarioDef = yamlLoad(fileContent, {
    schema: DEFAULT_SCHEMA.extend(
      new Type("!include", {
        kind: "scalar",
      })
    ),
  }) as RawScenarioDefinition;
  const allSwaggerFilePaths = getAllSwaggerFilePathUnderDir(dirname(dirname(apiScenarioFilePath)));
  const allSwaggerFiles = allSwaggerFilePaths.map((it) => {
    return {
      swaggerFilePath: it,
      swaggerObj: JSON.parse(fs.readFileSync(it).toString()),
    };
  });
  const findMatchedSwagger = (exampleFileName: string): string | undefined => {
    for (const it of allSwaggerFiles) {
      const allXmsExamplesPath = "$..x-ms-examples..$ref";
      const allXmsExampleValues = JSONPath({
        path: allXmsExamplesPath,
        json: it.swaggerObj,
        resultType: "all",
      });
      if (allXmsExampleValues.some((it: any) => it.value.includes(exampleFileName))) {
        return it.swaggerFilePath;
      }
    }
    return undefined;
  };
  const res: Set<string> = new Set<string>();

  for (const rawStep of rawScenarioDef.prepareSteps ?? []) {
    if ("exampleFile" in rawStep) {
      const swaggerFilePath = findMatchedSwagger(rawStep.exampleFile.replace(/^.*[\\\/]/, ""));
      if (swaggerFilePath !== undefined) {
        res.add(swaggerFilePath);
      }
    }
  }

  for (const rawScenario of rawScenarioDef.scenarios ?? []) {
    for (const rawStep of rawScenario.steps) {
      if ("exampleFile" in rawStep) {
        const swaggerFilePath = findMatchedSwagger(rawStep.exampleFile.replace(/^.*[\\\/]/, ""));
        if (swaggerFilePath !== undefined) {
          res.add(swaggerFilePath);
        }
      }
    }
  }

  for (const rawStep of rawScenarioDef.cleanUpSteps ?? []) {
    if ("exampleFile" in rawStep) {
      const swaggerFilePath = findMatchedSwagger(rawStep.exampleFile.replace(/^.*[\\\/]/, ""));
      if (swaggerFilePath !== undefined) {
        res.add(swaggerFilePath);
      }
    }
  }
  return Array.from(res.values());
};
