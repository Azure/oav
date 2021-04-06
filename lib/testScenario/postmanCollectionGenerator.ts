import { inject, injectable } from "inversify";
import { TYPES } from "../inversifyUtils";
import { VariableEnv } from "./variableEnv";
import { TestResourceLoader, TestResourceLoaderOption } from "./testResourceLoader";
import { PostmanCollectionRunnerClient } from "./postmanCollectionRunnerClient";
import { TestScenarioRunner } from "./testScenarioRunner";
export interface PostmanCollectionGeneratorOption extends TestResourceLoaderOption {
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
    private testResourceLoader: TestResourceLoader
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
    for (const item of testDef.testScenarios) {
      const client = new PostmanCollectionRunnerClient(
        `${this.opt.name}_${item.description.replace(/[\s]/g, "").replace(/\//g, "_")}`,
        this.testResourceLoader.jsonLoader,
        this.env,
        this.opt.testDef
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
      if (this.opt.generateCollection) {
        client.writeCollectionToJson(this.opt.outputFolder);
      }
      if (this.opt.runCollection) {
        await client.runCollection();
      }
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
