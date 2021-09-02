import { inject, injectable } from "inversify";
import { TYPES, inversifyGetInstance } from "../inversifyUtils";
import { FileLoader } from "../swagger/fileLoader";
import { ValidationLevel } from "./reportGenerator";
import { SwaggerAnalyzerOption } from "./swaggerAnalyzer";
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
  testDef: string;
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
    private testResourceLoader: ApiScenarioLoader,
    private fileLoader: FileLoader
  ) {
    this.env = new VariableEnv();
    this.env.setBatch(this.opt.env);
  }

  public async GenerateCollection(): Promise<void> {
    const testDef = await this.testResourceLoader.load(this.opt.testDef);
    this.env.setBatch(testDef.variables);
    for (const it of testDef.requiredVariables) {
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

    for (const testScenario of testDef.scenarios) {
      //TODO: replace index with testScenarioName
      const opts: PostmanCollectionRunnerClientOption = {
        testScenarioFileName: `${this.opt.name}`,
        testScenarioName: `${getFileNameFromPath(this.opt.testDef)}_${index}`,
        env: this.env,
        enableBlobUploader: this.opt.enableBlobUploader!,
        testScenarioFilePath: this.opt.testDef,
        reportOutputFolder: this.opt.outputFolder,
        markdownReportPath: this.opt.markdownReportPath,
        junitReportPath: this.opt.junitReportPath,
        runId: runId,
        jsonLoader: this.testResourceLoader.jsonLoader,
        baseUrl: this.opt.baseUrl,
        validationLevel: this.opt.validationLevel,
        from: this.opt.from,
        to: this.opt.to,
        skipCleanUp: this.opt.skipCleanUp,
        verbose: this.opt.verbose,
      };

      const client = inversifyGetInstance(PostmanCollectionRunnerClient, opts);
      const runner = new ApiScenarioRunner({
        jsonLoader: this.testResourceLoader.jsonLoader,
        env: this.env,
        client: client,
      });
      await runner.executeScenario(testScenario);
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
