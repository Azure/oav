import * as path from "path";
import * as fs from "fs";
import { inject, injectable } from "inversify";
import { dump as yamlDump } from "js-yaml";
import { ExampleDependency, SwaggerAnalyzer, SwaggerAnalyzerOption } from "../swaggerAnalyzer";
import { findNearestReadmeDir, getProviderFromFilePath } from "../../util/utils";
import { ReadmeTestDefinition, ReadmeTestFileLoader } from "../readmeTestFileLoader";
import { JsonLoader } from "../../swagger/jsonLoader";
import { setDefaultOpts } from "../../swagger/loader";

import { FileLoader } from "../../swagger/fileLoader";
import {
  RawScenarioDefinition,
  ScenarioDefinition,
  TestResources,
  RawStep,
  RawScenario,
} from "../apiScenarioTypes";
import { ApiScenarioLoaderOption } from "../apiScenarioLoader";
import { inversifyGetInstance, TYPES } from "../../inversifyUtils";

type GenerationRule = "resource-put-delete" | "operations-list";
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
  private exampleDependencies: ExampleDependency[] = [];
  private scenarioDefToWrite: Array<{ scenarioDef: RawScenarioDefinition; filePath: string }> = [];
  public constructor(
    @inject(TYPES.opts) private opts: StaticApiScenarioGeneratorOption,
    private swaggerAnalyzer: SwaggerAnalyzer,
    private fileLoader: FileLoader,
    private jsonLoader: JsonLoader,
    private readmeTestFileLoader: ReadmeTestFileLoader
  ) {}

  public static create(opts: StaticApiScenarioGeneratorOption) {
    setDefaultOpts(opts, {
      tag: "default",
      swaggerFilePaths: [],
      eraseXmsExamples: false,
      eraseDescription: false,
      filerTopLevelResourceType: true,
      noExternalDependencyResourceType: true,
      rules: ["resource-put-delete"],
    });
    return inversifyGetInstance(StaticApiScenarioGenerator, opts);
  }

  public async initialize() {
    this.exampleDependencies = await this.swaggerAnalyzer.analyzeDependency();
  }

  private async generateListOperationTestScenario(): Promise<any> {
    const scenarioDef: RawScenarioDefinition = {
      scope: "ResourceGroup",
      scenarios: [],
    };
    const paths = await this.swaggerAnalyzer.getOperationListPath();
    for (const it of paths) {
      const example = Object.values(it.get?.["x-ms-examples"] || {});
      const listOperationsExampleFilePath = this.swaggerAnalyzer.jsonLoader.getRealPath(
        example[0].$ref!
      );
      const exampleDir = path.dirname(listOperationsExampleFilePath);
      const testSteps: RawStep[] = [
        {
          step: "operationsList",
          exampleFile: getExampleOutputPath(listOperationsExampleFilePath),
        },
      ];
      scenarioDef.scenarios.push({
        scenario: "operationsListScenario",
        description: "Generated scenario for operation list",
        steps: testSteps,
      });
      this.scenarioDefToWrite.push({
        scenarioDef: scenarioDef,
        filePath: getTestDefOutputPath(exampleDir, `operationsList`),
      });
    }
    return scenarioDef;
  }

  /**
   *
   * @param resourceType ResourceType. e.g.Microsoft.Compute/snapshots
   * @returns
   */
  private async generatePutDeleteApiScenario(resourceType: string): Promise<ScenarioDefinition> {
    const scenarioDef: RawScenarioDefinition = {
      scope: "ResourceGroup",
      scenarios: [],
    };
    let exampleDir = "";
    const paths = this.swaggerAnalyzer.getPathByResourceType(resourceType);
    if (paths === undefined) {
      throw new Error(`Can not find path from resource type ${resourceType}`);
    }
    const CRUDPath = paths[0];
    const deletedExample = Object.values(CRUDPath.delete?.["x-ms-examples"] || {});
    let deleteExampleFilePath = "";
    if (deletedExample.length > 0) {
      deleteExampleFilePath = getExampleOutputPath(
        this.swaggerAnalyzer.jsonLoader.getRealPath(deletedExample[0].$ref!)
      );
    }
    const deleteExampleName = Object.keys(CRUDPath.delete?.["x-ms-examples"] || {})[0];
    for (const [exampleName, exampleRef] of Object.entries(CRUDPath.put?.["x-ms-examples"] || {})) {
      if (exampleDir === "") {
        exampleDir = path.dirname(this.swaggerAnalyzer.jsonLoader.getRealPath(exampleRef.$ref!));
      }
      const exampleDependency = this.swaggerAnalyzer.getExampleDependencyByExamplePath(
        this.jsonLoader.getRealPath(exampleRef.$ref!)
      );

      // Currently only filter no external dependency examples.
      if (exampleDependency === undefined || exampleDependency?.externalDependency.length > 0) {
        continue;
      }

      // TODO: get dependency and inject dependency ARM template into step
      const step: RawStep = {
        step: exampleName,
        exampleFile: getExampleOutputPath(
          this.swaggerAnalyzer.jsonLoader.getRealPath(exampleRef.$ref!)
        ),
      };
      const steps = [step];
      if (deleteExampleFilePath !== "") {
        const step: RawStep = {
          step: deleteExampleName,
          exampleFile: deleteExampleFilePath,
        };
        steps.push(step);
      }

      const scenarioName = `${resourceType}_${exampleName}`;
      const scenario: RawScenario = {
        scenario: scenarioName,
        description: `Generated scenario for ${resourceType} with ${exampleName}`,
        steps: steps,
      };
      scenarioDef.scenarios.push(scenario);
    }
    this.scenarioDefToWrite.push({
      scenarioDef: scenarioDef,
      filePath: getTestDefOutputPath(exampleDir, `${resourceType}`),
    });

    return {} as any;
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
    await this.writeReadmeTest();
  }

  private async writeReadmeTest() {
    if (this.scenarioDefToWrite.length === 0) {
      return;
    }
    const testResources: TestResources = { "test-resources": [] };
    for (const { filePath } of this.scenarioDefToWrite) {
      const resourceProvider = getProviderFromFilePath(filePath) || "";
      const relativePath = filePath.substr(filePath.indexOf(resourceProvider), filePath.length);
      testResources["test-resources"].push({ test: relativePath });
    }
    const readmeDir = findNearestReadmeDir(this.scenarioDefToWrite[0].filePath);
    if (readmeDir === undefined) {
      throw new Error(`Can not find nearest readme dir.`);
    }
    const readmeTestFilePath = path.resolve(
      findNearestReadmeDir(this.scenarioDefToWrite[0].filePath)!,
      "readme.test.md"
    );
    console.log(`write generated file ${readmeTestFilePath}`);
    if (fs.existsSync(readmeTestFilePath)) {
      //Already exist readme.test.md, override yaml block.
      const currentReadmeTestDef = await this.readmeTestFileLoader.load(readmeTestFilePath);
      currentReadmeTestDef[this.opts.tag || ""] = testResources;
      await this.readmeTestFileLoader.writeFile(readmeTestFilePath, currentReadmeTestDef);
    } else {
      const readmeTestDef: ReadmeTestDefinition = {};
      readmeTestDef[this.opts.tag || ""] = testResources;
      await this.readmeTestFileLoader.writeFile(readmeTestFilePath, readmeTestDef);
    }
  }

  public async generateTestDefFiles() {
    const resourceTypes: Set<string> = new Set<string>();
    for (const it of this.exampleDependencies) {
      resourceTypes.add(it.fullResourceType);
    }
    if (this.opts.rules?.includes("operations-list")) {
      console.log("generate operations list");
      await this.generateListOperationTestScenario();
    }
    for (const resourceType of resourceTypes) {
      if (this.opts.rules?.includes("resource-put-delete")) {
        await this.generatePutDeleteApiScenario(resourceType);
      }
    }
  }
}

function getExampleOutputPath(exampleFilePath: string): string {
  const idx = exampleFilePath.indexOf("examples");
  return `../${exampleFilePath.substr(idx, exampleFilePath.length)}`;
}

function getTestDefOutputPath(exampleFilePath: string, resourceType: string): string {
  const idx = exampleFilePath.indexOf("examples");
  const ret = path.resolve(
    `${exampleFilePath.substr(0, idx)}test-scenarios/${resourceType.split("/").pop()}.yaml`
  );
  return ret;
}
