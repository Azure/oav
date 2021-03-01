import { VariableEnv } from "./variableEnv";
import { TestResourceLoader } from "./testResourceLoader";
import { PostmanCollectionRunnerClient } from "./postmanCollectionRunnerClient";
import { TestScenarioRunner } from "./testScenarioRunner";
export interface PostmanCollectionGeneratorOption {
  name: string;
  fileRoot: string;
  swaggerFilePaths: string[];
  testDef: string;
  env: {};
  outputFolder: string;
}

export class PostmanCollectionGenerator {
  private testResourceLoader: TestResourceLoader;
  private env: VariableEnv;
  private outputFolder: string;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(private opt: PostmanCollectionGeneratorOption) {
    this.testResourceLoader = TestResourceLoader.create({
      useJsonParser: false,
      checkUnderFileRoot: false,
      fileRoot: this.opt.fileRoot,
      swaggerFilePaths: this.opt.swaggerFilePaths,
    });
    this.env = new VariableEnv();
    this.env.setBatch(this.opt.env);
    this.outputFolder = this.opt.outputFolder;
  }

  public async GenerateCollection(): Promise<void> {
    const testDef = await this.testResourceLoader.load(this.opt.testDef);
    for (const item of testDef.testScenarios) {
      const client = new PostmanCollectionRunnerClient(
        `${this.opt.name}_${item.description.replace(/\s/g, "")}`,
        this.testResourceLoader.jsonLoader,
        this.env
      );
      const runner = new TestScenarioRunner({
        jsonLoader: this.testResourceLoader.jsonLoader,
        env: this.env,
        client: client,
      });
      await runner.executeScenario(item);
      // If shared resource-group, move clean to one separate scenario.
      await runner.cleanAllTestScope();
      for (let i = 0; i < client.collection.items.count(); i++) {
        this.longRunningOperationOrderUpdate(client, i);
      }
      client.writeCollectionToJson(this.outputFolder);
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
