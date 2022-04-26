import { resolve as pathResolve, dirname } from "path";
import { injectable } from "inversify";
import { Type, YAMLException, load as yamlLoad, DEFAULT_SCHEMA } from "js-yaml";
import { default as AjvInit, ValidateFunction } from "ajv";
import { Loader } from "../swagger/loader";
import { FileLoader } from "../swagger/fileLoader";
import { RawScenarioDefinition, RawStep, ReadmeTag } from "./apiScenarioTypes";
import { ApiScenarioDefinition } from "./apiScenarioSchema";

const ajv = new AjvInit({
  useDefaults: true,
});

@injectable()
export class ApiScenarioYamlLoader implements Loader<[RawScenarioDefinition, ReadmeTag[]]> {
  private fileCache: Map<string, string> = new Map();
  private validateApiScenarioFile: ValidateFunction;

  public constructor(private fileLoader: FileLoader) {
    this.validateApiScenarioFile = ajv.compile(ApiScenarioDefinition);
  }

  public async load(filePath: string): Promise<[RawScenarioDefinition, ReadmeTag[]]> {
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

    const readmeTags: ReadmeTag[] = [];
    const tempSet = new Set<string>();
    const rawDef = filePayload as RawScenarioDefinition;

    const consumeStep = (step: RawStep) => {
      if ("readmeTag" in step && step.readmeTag) {
        if (!tempSet.has(step.readmeTag)) {
          tempSet.add(step.readmeTag);
          const match = /(\S+\/readme\.md)(#[a-z][a-z0-9-]+)?/i.exec(step.readmeTag);
          if (match) {
            readmeTags.push({
              readme: match[1],
              tag: match[2],
            });
          } else {
            throw new Error(`Invalid readmeTag: ${step.readmeTag} in step ${step}`);
          }
        }
      }
    };

    rawDef.prepareSteps?.forEach(consumeStep);
    rawDef.scenarios.forEach((scenario) => scenario.steps.forEach(consumeStep));
    rawDef.cleanUpSteps?.forEach(consumeStep);

    return [rawDef, readmeTags];
  }
}
