import * as path from "path";
import * as fs from "fs";
import { inject, injectable } from "inversify";
import { dump as yamlDump } from "js-yaml";
import { ExampleDependency, SwaggerAnalyzer, SwaggerAnalyzerOption } from "../swaggerAnalyzer";
import { findNearestReadmeDir, getProviderFromFilePath } from "../../util/utils";
import { ReadmeTestDefinition, ReadmeTestFileLoader } from "../readmeTestFileLoader";
import { JsonLoader } from "./../../swagger/jsonLoader";
import { setDefaultOpts } from "./../../swagger/loader";

import { FileLoader } from "./../../swagger/fileLoader";
import {
  RawTestDefinitionFile,
  RawTestScenarioContainer,
  RawTestStepContainer,
  TestDefinitionFile,
  TestResources,
} from "./../testResourceTypes";
import { TestResourceLoaderOption } from "./../testResourceLoader";
import { inversifyGetInstance, TYPES } from "./../../inversifyUtils";

type GenerationRule = "resource-put-delete" | "operations-list";
export interface StaticTestScenarioGeneratorOption
  extends TestResourceLoaderOption,
    SwaggerAnalyzerOption {
  swaggerFilePaths: string[];
  rules?: GenerationRule[];
  tag?: string;
}

/**
 * Generate test scenario file by analyzing swagger resource type dependencies.
 */
@injectable()
export class StaticTestScenarioGenerator {
  private exampleDependencies: ExampleDependency[] = [];
  private testDefToWrite: Array<{ testDef: RawTestDefinitionFile; filePath: string }> = [];
  public constructor(
    @inject(TYPES.opts) private opts: StaticTestScenarioGeneratorOption,
    private swaggerAnalyzer: SwaggerAnalyzer,
    private fileLoader: FileLoader,
    private jsonLoader: JsonLoader,
    private readmeTestFileLoader: ReadmeTestFileLoader
  ) {}

  public static create(opts: StaticTestScenarioGeneratorOption) {
    setDefaultOpts(opts, {
      tag: "default",
      swaggerFilePaths: [],
      eraseXmsExamples: false,
      eraseDescription: false,
      filerTopLevelResourceType: true,
      noExternalDependencyResourceType: true,
      rules: ["resource-put-delete"],
    });
    return inversifyGetInstance(StaticTestScenarioGenerator, opts);
  }

  public async initialize() {
    this.exampleDependencies = await this.swaggerAnalyzer.analyzeDependency();
  }

  private async generateListOperationTestScenario(): Promise<any> {
    const testDef: RawTestDefinitionFile = {
      scope: "ResourceGroup",
      testScenarios: [],
    };
    const paths = await this.swaggerAnalyzer.getOperationListPath();
    for (const it of paths) {
      const example = Object.values(it.get?.["x-ms-examples"] || {});
      const listOperationsExampleFilePath = this.swaggerAnalyzer.jsonLoader.getRealPath(
        example[0].$ref!
      );
      const exampleDir = path.dirname(listOperationsExampleFilePath);
      const testSteps: RawTestStepContainer[] = [
        {
          operationsList: {
            exampleFile: getExampleOutputPath(listOperationsExampleFilePath),
          },
        },
      ];
      testDef.testScenarios.push({
        operationsListScenario: {
          description: "Generated scenario for operation list",
          steps: testSteps,
        },
      });
      this.testDefToWrite.push({
        testDef: testDef,
        filePath: getTestDefOutputPath(exampleDir, `operationsList`),
      });
    }
    return testDef;
  }

  /**
   *
   * @param resourceType ResourceType. e.g.Microsoft.Compute/snapshots
   * @returns
   */
  private async generatePutDeleteTestScenario(resourceType: string): Promise<TestDefinitionFile> {
    const testDef: RawTestDefinitionFile = {
      scope: "ResourceGroup",
      testScenarios: [],
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
      const testStep: RawTestStepContainer = {};
      testStep[exampleName] = {
        exampleFile: getExampleOutputPath(
          this.swaggerAnalyzer.jsonLoader.getRealPath(exampleRef.$ref!)
        ),
      };
      const testSteps = [testStep];
      if (deleteExampleFilePath !== "") {
        const testStep: RawTestStepContainer = {};
        testStep[deleteExampleName] = {
          exampleFile: deleteExampleFilePath,
        };
        testSteps.push(testStep);
      }

      const scenarioName = `${resourceType}_${exampleName}`;
      const testScenarioContainer: RawTestScenarioContainer = {};
      testScenarioContainer[scenarioName] = {
        description: `Generated scenario for ${resourceType} with ${exampleName}`,
        steps: testSteps,
      };
      testDef.testScenarios.push(testScenarioContainer);
    }
    this.testDefToWrite.push({
      testDef: testDef,
      filePath: getTestDefOutputPath(exampleDir, `${resourceType}`),
    });

    return {} as any;
  }

  public async writeTestDefinitionFile(filePath: string, testDef: RawTestDefinitionFile) {
    const fileContent = yamlDump(testDef);
    return this.fileLoader.writeFile(filePath, fileContent);
  }

  public async writeGeneratedFiles() {
    for (const { testDef, filePath } of this.testDefToWrite) {
      console.log(`write generated file ${filePath}`);
      await this.writeTestDefinitionFile(filePath, testDef);
    }
    await this.writeReadmeTest();
  }

  private async writeReadmeTest() {
    if (this.testDefToWrite.length === 0) {
      return;
    }
    const testResources: TestResources = { "test-resources": [] };
    for (const { filePath } of this.testDefToWrite) {
      const resourceProvider = getProviderFromFilePath(filePath) || "";
      const relativePath = filePath.substr(filePath.indexOf(resourceProvider), filePath.length);
      testResources["test-resources"].push({ test: relativePath });
    }
    const readmeDir = findNearestReadmeDir(this.testDefToWrite[0].filePath);
    if (readmeDir === undefined) {
      throw new Error(`Can not find nearest readme dir.`);
    }
    const readmeTestFilePath = path.resolve(
      findNearestReadmeDir(this.testDefToWrite[0].filePath)!,
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
    for (const resourceType of resourceTypes) {
      if (this.opts.rules?.includes("operations-list")) {
        await this.generateListOperationTestScenario();
      }
      if (this.opts.rules?.includes("resource-put-delete")) {
        await this.generatePutDeleteTestScenario(resourceType);
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
