import * as path from "path";
import { inject, injectable } from "inversify";
import { TYPES, inversifyGetInstance } from "../inversifyUtils";
import { FileLoader } from "../swagger/fileLoader";
import { SwaggerAnalyzerOption } from "./swaggerAnalyzer";
import { BlobUploaderOption } from "./blobUploader";
import { VariableEnv } from "./variableEnv";
import { TestResourceLoader, TestResourceLoaderOption } from "./testResourceLoader";
import {
  generateRunId,
  PostmanCollectionRunnerClient,
  PostmanCollectionRunnerClientOption,
} from "./postmanCollectionRunnerClient";
import { TestScenarioRunner } from "./testScenarioRunner";
import { getFileNameFromPath } from "./defaultNaming";
import { generateMarkdownReportHeader } from "./markdownReport";
export interface PostmanCollectionGeneratorOption
  extends TestResourceLoaderOption,
    BlobUploaderOption,
    SwaggerAnalyzerOption {
  name: string;
  fileRoot: string;
  swaggerFilePaths: string[];
  testDef: string;
  env: {};
  outputFolder: string;
  markdownReportPath?: string;
  runCollection: boolean;
  generateCollection: boolean;
  baseUrl: string;
}

@injectable()
export class PostmanCollectionGenerator {
  private env: VariableEnv;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opt: PostmanCollectionGeneratorOption,
    private testResourceLoader: TestResourceLoader,
    private fileLoader: FileLoader
  ) {
    this.env = new VariableEnv();
    this.env.setBatch(this.opt.env);
  }

  public async GenerateCollection(): Promise<void> {
    const testDef = await this.testResourceLoader.load(this.opt.testDef);
    for (const it of testDef.requiredVariables) {
      if (this.env.get(it) === undefined) {
        throw new Error(
          `Missing required variable '${it}', please set variable values in env.json.`
        );
      }
    }
    let index = 0;
    const runId = generateRunId();
    if (this.opt.markdownReportPath) {
      await this.fileLoader.writeFile(
        path.join(process.cwd(), this.opt.markdownReportPath),
        generateMarkdownReportHeader()
      );
    }
    for (const testScenario of testDef.testScenarios) {
      //TODO: replace index with testScenarioName
      const opts: PostmanCollectionRunnerClientOption = {
        testScenarioFileName: `${this.opt.name}`,
        testScenarioName: `${getFileNameFromPath(this.opt.testDef)}_${index}`,
        env: this.env,
        enableBlobUploader: this.opt.enableBlobUploader!,
        testScenarioFilePath: this.opt.testDef,
        reportOutputFolder: this.opt.outputFolder,
        markdownReportPath: this.opt.markdownReportPath,
        runId: runId,
        jsonLoader: this.testResourceLoader.jsonLoader,
        baseUrl: this.opt.baseUrl,
      };

      const client = inversifyGetInstance(PostmanCollectionRunnerClient, opts);
      const runner = new TestScenarioRunner({
        jsonLoader: this.testResourceLoader.jsonLoader,
        env: this.env,
        client: client,
      });
      await runner.executeScenario(testScenario);
      // If shared resource-group, move clean to one separate scenario.
      await runner.cleanAllTestScope();
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
