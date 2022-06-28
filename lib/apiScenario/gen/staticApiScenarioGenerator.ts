import * as path from "path";
import { inject, injectable } from "inversify";
import { dump as yamlDump } from "js-yaml";
import { SwaggerAnalyzer, SwaggerAnalyzerOption } from "../swaggerAnalyzer";
import { setDefaultOpts } from "../../swagger/loader";

import { FileLoader } from "../../swagger/fileLoader";
import { RawScenarioDefinition, RawStep } from "../apiScenarioTypes";
import { ApiScenarioLoaderOption } from "../apiScenarioLoader";
import { inversifyGetInstance, TYPES } from "../../inversifyUtils";

type GenerationRule = "operations-list";
export interface StaticApiScenarioGeneratorOption
  extends ApiScenarioLoaderOption,
    SwaggerAnalyzerOption {
  swaggerFilePaths: string[];
  rules?: GenerationRule[];
  tag?: string;
}

/**
 * Generate test scenario file by analyzing swagger resource type dependencies.
 */
@injectable()
export class StaticApiScenarioGenerator {
  private scenarioDefToWrite: Array<{ scenarioDef: RawScenarioDefinition; filePath: string }> = [];
  public constructor(
    @inject(TYPES.opts) private opts: StaticApiScenarioGeneratorOption,
    private swaggerAnalyzer: SwaggerAnalyzer,
    private fileLoader: FileLoader
  ) {}

  public static create(opts: StaticApiScenarioGeneratorOption) {
    setDefaultOpts(opts, {
      tag: "default",
      swaggerFilePaths: [],
      eraseXmsExamples: false,
      eraseDescription: false,
      filerTopLevelResourceType: true,
      noExternalDependencyResourceType: true,
      rules: ["operations-list"],
    });
    return inversifyGetInstance(StaticApiScenarioGenerator, opts);
  }

  public async initialize() {
    await this.swaggerAnalyzer.initialize();
  }

  private async generateListOperationTestScenario(): Promise<any> {
    const scenarioDef: RawScenarioDefinition = {
      scope: "ResourceGroup",
      scenarios: [],
    };
    const paths = await this.swaggerAnalyzer.getOperationListPath();
    for (const it of paths) {
      const testSteps: RawStep[] = [
        {
          step: "operationsList",
          operationId: it.get?.operationId!,
        },
      ];
      scenarioDef.scenarios.push({
        scenario: "operationsListScenario",
        description: "Generated scenario for operation list",
        steps: testSteps,
      });
      this.scenarioDefToWrite.push({
        scenarioDef: scenarioDef,
        filePath: path.resolve(it._spec._filePath, "../scenarios", "operationsList.yaml"),
      });
    }
    return scenarioDef;
  }

  public async writeScenarioDefinitionFile(filePath: string, scenarioDef: RawScenarioDefinition) {
    const fileContent = yamlDump(scenarioDef);
    return this.fileLoader.writeFile(filePath, fileContent);
  }

  public async writeGeneratedFiles() {
    for (const { scenarioDef: scenarioDef, filePath } of this.scenarioDefToWrite) {
      console.log(`write generated file ${filePath}`);
      await this.writeScenarioDefinitionFile(filePath, scenarioDef);
    }
  }

  public async generateTestDefFiles() {
    if (this.opts.rules?.includes("operations-list")) {
      console.log("generate operations list");
      await this.generateListOperationTestScenario();
    }
  }
}
