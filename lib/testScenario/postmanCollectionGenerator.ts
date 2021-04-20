import { inject, injectable } from "inversify";
import { TYPES } from "../inversifyUtils";
import { BlobUploader, TestScenarioBlobUploaderOption } from "./blobUploader";
import { VariableEnv } from "./variableEnv";
import { TestResourceLoader, TestResourceLoaderOption } from "./testResourceLoader";
import { PostmanCollectionRunnerClient } from "./postmanCollectionRunnerClient";
import { TestScenarioRunner } from "./testScenarioRunner";
export interface PostmanCollectionGeneratorOption
  extends TestResourceLoaderOption,
    TestScenarioBlobUploaderOption {
  name: string;
  fileRoot: string;
  swaggerFilePaths: string[];
  testDef: string;
  env: {};
  outputFolder: string;
  runCollection: boolean;
  generateCollection: boolean;
}

@injectable()
export class PostmanCollectionGenerator {
  private env: VariableEnv;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opt: PostmanCollectionGeneratorOption,
    private testResourceLoader: TestResourceLoader,
    private blobUploader: BlobUploader
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
    //Use index to avoid overwrite newman report
    let index = 0;
    for (const testScenario of testDef.testScenarios) {
      const client = new PostmanCollectionRunnerClient(
        `${this.opt.name}/${index}`,
        this.testResourceLoader.jsonLoader,
        this.env,
        this.blobUploader,
        this.opt.testDef,
        this.opt.outputFolder,
        this.opt.enableBlobUploader
      );
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
