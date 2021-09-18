import { inject, injectable } from "inversify";
import { TYPES, inversifyGetInstance } from "../inversifyUtils";
import { FileLoader } from "../swagger/fileLoader";
import { ValidationLevel } from "./reportGenerator";
import { SwaggerAnalyzer, SwaggerAnalyzerOption } from "./swaggerAnalyzer";
import { BlobUploaderOption } from "./blobUploader";
import { VariableEnv } from "./variableEnv";
import { ApiScenarioLoader, ApiScenarioLoaderOption } from "./apiScenarioLoader";
import {
  generateRunId,
  PostmanCollectionRunnerClient,
  PostmanCollectionRunnerClientOption,
} from "./postmanCollectionRunnerClient";
import { ApiScenarioRunner } from "./apiScenarioRunner";
import { getFileNameFromPath } from "./defaultNaming";
import { generateMarkdownReportHeader } from "./markdownReport";
export interface PostmanCollectionGeneratorOption
  extends ApiScenarioLoaderOption,
    BlobUploaderOption,
    SwaggerAnalyzerOption {
  name: string;
  fileRoot: string;
  swaggerFilePaths: string[];
  scenarioDef: string;
  env: {};
  outputFolder: string;
  markdownReportPath?: string;
  junitReportPath?: string;
  runCollection: boolean;
  generateCollection: boolean;
  baseUrl: string;
  validationLevel?: ValidationLevel;
  skipCleanUp?: boolean;
  from?: string;
  to?: string;
  runId?: string;
  verbose?: boolean;
}

@injectable()
export class PostmanCollectionGenerator {
  private env: VariableEnv;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opt: PostmanCollectionGeneratorOption,
    private apiScenarioLoader: ApiScenarioLoader,
    private fileLoader: FileLoader,
    private swaggerAnalyzer: SwaggerAnalyzer
  ) {
    this.env = new VariableEnv("runtime");
    this.env.setBatch(this.opt.env);
  }

  public async GenerateCollection(): Promise<void> {
    const scenarioDef = await this.apiScenarioLoader.load(this.opt.scenarioDef);
    this.env.setBatch(scenarioDef.variables);
    await this.swaggerAnalyzer.initialize();
    for (const it of scenarioDef.requiredVariables) {
      if (this.env.get(it) === undefined) {
        throw new Error(
          `Missing required variable '${it}', please set variable values in env.json.`
        );
      }
    }
    let index = 0;
    const runId = this.opt.runId || generateRunId();
    if (this.opt.markdownReportPath) {
      await this.fileLoader.writeFile(this.opt.markdownReportPath, generateMarkdownReportHeader());
    }

    for (const scenario of scenarioDef.scenarios) {
      //TODO: replace index with testScenarioName
      const opts: PostmanCollectionRunnerClientOption = {
        testScenarioFileName: `${this.opt.name}`,
        testDef: scenarioDef,
        testScenarioName: `${getFileNameFromPath(this.opt.scenarioDef)}_${index}`,
        env: this.env,
        enableBlobUploader: this.opt.enableBlobUploader!,
        testScenarioFilePath: this.opt.scenarioDef,
        reportOutputFolder: this.opt.outputFolder,
        markdownReportPath: this.opt.markdownReportPath,
        junitReportPath: this.opt.junitReportPath,
        runId: runId,
        jsonLoader: this.apiScenarioLoader.jsonLoader,
        baseUrl: this.opt.baseUrl,
        validationLevel: this.opt.validationLevel,
        from: this.opt.from,
        to: this.opt.to,
        skipCleanUp: this.opt.skipCleanUp,
        verbose: this.opt.verbose,
      };

      const client = inversifyGetInstance(PostmanCollectionRunnerClient, opts);
      const runner = new ApiScenarioRunner({
        jsonLoader: this.apiScenarioLoader.jsonLoader,
        env: this.env,
        client: client,
        resolveVariables: false,
      });
      await runner.executeScenario(scenario);
      // If shared resource-group, move clean to one separate scenario.
      if (!this.opt.skipCleanUp && !this.opt.to) {
        await runner.cleanAllScope();
      }
      for (let i = 0; i < client.collection.items.count(); i++) {
        this.longRunningOperationOrderUpdate(client, i);
      }
      if (this.opt.generateCollection) {
        await client.writeCollectionToJson(this.opt.outputFolder);
      }
      if (this.opt.runCollection) {
        await client.runCollection();
      }
      index++;
    }
    const operationIdCoverageResult = this.swaggerAnalyzer.calculateOperationCoverage(scenarioDef);
    console.log(
      `Operation coverage ${(operationIdCoverageResult.coverage * 100).toFixed(2) + "%"} (${
        operationIdCoverageResult.coveredOperationNumber
      }/${operationIdCoverageResult.totalOperationNumber})`
    );
    if (operationIdCoverageResult.uncoveredOperationIds.length > 0) {
      console.log("Uncovered operationIds: ");
      console.log(operationIdCoverageResult.uncoveredOperationIds);
    }
  }

  private longRunningOperationOrderUpdate(client: PostmanCollectionRunnerClient, i: number) {
    if (client.collection.items.idx(i).name.search("poller$") !== -1) {
      const env = new VariableEnv();
      const nextRequestName =
        i + 2 < client.collection.items.count()
          ? `'${client.collection.items.idx(i + 2).name}'`
          : "null";
      env.setBatch({ nextRequest: nextRequestName });
      const exec = client.collection.items.idx(i).events.idx(0).script.toSource() as string;
      client.collection.items
        .idx(i)
        .events.idx(0)
        .update({ script: { type: "text/javascript", exec: env.resolveString(exec) } });
    }
  }
}
