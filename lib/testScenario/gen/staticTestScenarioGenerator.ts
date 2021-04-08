import * as path from "path";
import { inject, injectable } from "inversify";
import { dump as yamlDump } from "js-yaml";
import { ExampleDependency, SwaggerAnalyzer, SwaggerAnalyzerOption } from "../swaggerAnalyzer";
import { JsonLoader } from "./../../swagger/jsonLoader";
import { setDefaultOpts } from "./../../swagger/loader";

import { FileLoader } from "./../../swagger/fileLoader";
import { RawTestDefinitionFile, TestDefinitionFile } from "./../testResourceTypes";
import { TestResourceLoaderOption } from "./../testResourceLoader";
import { inversifyGetInstance, TYPES } from "./../../inversifyUtils";

export interface StaticTestScenarioGeneratorOption
  extends TestResourceLoaderOption,
    SwaggerAnalyzerOption {
  swaggerFilePaths: string[];
  rule?: "put-delete";
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
    private jsonLoader: JsonLoader
  ) {}

  public static create(opts: StaticTestScenarioGeneratorOption) {
    setDefaultOpts(opts, {
      swaggerFilePaths: [],
      eraseXmsExamples: false,
      eraseDescription: false,
      filerTopLevelResourceType: true,
      noExternalDependencyResourceType: true,
      rule: "put-delete",
    });
    return inversifyGetInstance(StaticTestScenarioGenerator, opts);
  }

  public async initialize() {
    this.exampleDependencies = await this.swaggerAnalyzer.analyzeDependency();
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
      const testStep = [
        {
          step: exampleName,
          exampleFile: getExampleOutputPath(
            this.swaggerAnalyzer.jsonLoader.getRealPath(exampleRef.$ref!)
          ),
        },
      ];
      if (deleteExampleFilePath !== "") {
        testStep.push({
          step: deleteExampleName,
          exampleFile: deleteExampleFilePath,
        });
      }
      testDef.testScenarios.push({
        description: `${resourceType} ${exampleName}`,
        steps: testStep,
      });
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
  }

  public async generateTestDefFiles() {
    const resourceTypes: Set<string> = new Set<string>();
    for (const it of this.exampleDependencies) {
      resourceTypes.add(it.resourceType);
    }
    for (const resourceType of resourceTypes) {
      if (this.opts.rule === "put-delete") {
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
