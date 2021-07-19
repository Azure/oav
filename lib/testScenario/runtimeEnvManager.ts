import { existsSync, readFileSync, writeFileSync } from "fs";
import { Collection, VariableDefinition } from "postman-collection";
import * as path from "path";
import { mkdirpSync, removeSync } from "fs-extra";
import { PostmanCollectionRunnerClientOption } from "./postmanCollectionRunnerClient";

type RuntimeEnvContainer = {
  afterStep?: { [key: string]: VariableDefinition }; // to save env when the item is completed, not used now.
  beforeStep?: { [key: string]: VariableDefinition }; // to save env when the item starts.
};

export class RuntimeEnvManager {
  private runtimeFolder: string;
  private hasCleanedFlag = false;
  private opts: PostmanCollectionRunnerClientOption;
  private collection:Collection
  private runtimeEnvCollection: Map<string, RuntimeEnvContainer> = new Map<string,RuntimeEnvContainer>();

  constructor(runtimeFolder: string, opts: PostmanCollectionRunnerClientOption,collection:Collection) {
    this.runtimeFolder = runtimeFolder;
    this.opts = opts;
    this.collection = collection
  }

  public save = (
    itemName: string,
    eventEmitter: any,
    eventType: "beforeStep" | "afterStep"
  ) => {
    if (eventEmitter && eventEmitter.summary) {
      const environment = eventEmitter.summary.environment.syncVariablesTo();
      let envContainer = this.runtimeEnvCollection.get(itemName);
      if (!envContainer) {
        envContainer = {};
      }
      switch (eventType) {
        case "afterStep": {
          envContainer.afterStep = environment;
          break;
        }
        case "beforeStep": {
          envContainer.beforeStep = environment;
          break;
        }
      }
      this.runtimeEnvCollection.set(itemName, envContainer);
      const envFile = this.generateRuntimeEnvPath(itemName);
      if (!existsSync(path.dirname(envFile))) {
        mkdirpSync(path.dirname(envFile));
      }
      writeFileSync(this.generateRuntimeEnvPath(itemName), JSON.stringify(envContainer, null, 2));
    }
  };
  public loadEnv = (fromStep: string) => {
    const runtimeEnvPath = this.generateRuntimeEnvPath(fromStep);
     if (!existsSync(runtimeEnvPath)) {
       throw new Error(
         `the last runtime env file ${runtimeEnvPath} for step '${fromStep}' did not exist. `
       );
     }
    const runtimeEnvContainer = JSON.parse(
      readFileSync(runtimeEnvPath).toString()
    ) as RuntimeEnvContainer;

    if (!runtimeEnvContainer.beforeStep) {
      throw new Error(
        `could not load last runtime env for step '${fromStep}', please check the file ${runtimeEnvPath} `
      );
    }
    return runtimeEnvContainer.beforeStep
  };

  public repopulateCollectionItems = (from?: string, to?: string) => {
    if (!from && !to) {
      return;
    }
    const collection = this.collection
    const fromIndex = from ? this.getStepIndex(collection, from) : 0;
    let toIndex = to ? this.getStepIndex(collection, to) : collection.items.count() - 1;

    if (fromIndex > toIndex) {
      throw new Error(`the step '${from}' is after the step '${to}', please check the command arguments.`)
    }

    // keep the poller and delay steps in the last step.
    while (to && toIndex + 1 < collection.items.count()) {
      const itemName = collection.items.idx(toIndex + 1).name;
      if (itemName.startsWith(`[generated]${to}`)) {
        toIndex++;
      } else {
        break;
      }
    }
    const items = [];
    for (let idx = fromIndex; idx <= toIndex; idx++) {
      if (idx < collection.items.count())
        items.push(collection.items.idx(idx));
    }
    collection.items.repopulate(items);
  };

  public clean = () => {
    if (this.hasCleanedFlag) {
      return;
    }
    const fromStep = this.opts.from || this.opts.to ? this.collection.items.idx(0).name : undefined;
    if (fromStep) {
      this.cleanEnv(this.collection, fromStep);
    }
    this.hasCleanedFlag = true;
  };

  private generateRuntimeEnvPath = (step: string) => {
    const envFilePostfix = "_env.json";
    return path.join(this.runtimeFolder, ".runtime", step + envFilePostfix);
  };

  private cleanEnv = (collection: Collection, fromStep: string) => {
    const fromIndex = this.getStepIndex(collection, fromStep);
    const count = collection.items.count();
    for (let idx = fromIndex + 1; idx < count; idx++) {
      const envPath = this.generateRuntimeEnvPath(collection.items.idx(idx).name);
      if (existsSync(envPath)) {
        removeSync(envPath);
      }
    }
  };
  private getStepIndex = (collection: Collection, stepName: string) => {
    const item = collection.items.find((item) => item.name === stepName, null);
    if (!item) {
      throw new Error(`the runtime environment file for step '${stepName}' did not exist in the test scenario.`);
    }
    return collection.items.indexOf(item.id);
  };
}