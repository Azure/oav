import { existsSync, readFileSync, writeFileSync } from "fs";
import * as path from "path";
import { Collection, VariableDefinition } from "postman-collection";
import { mkdirpSync, removeSync } from "fs-extra";
import { printWarning } from "../util/utils";
import { PostmanCollectionRunnerClientOption } from "./postmanCollectionRunnerClient";

interface RuntimeEnvContainer {
  afterStep?: { [key: string]: VariableDefinition }; // to save env when the item is completed, not used now.
  beforeStep?: { [key: string]: VariableDefinition }; // to save env when the item starts.
}

export class RuntimeEnvManager {
  private hasCleanedFlag = false;
  /**
   * the Map key is a test scenario step name, and the value is its runtime env.
   */
  private runtimeEnvCollection: Map<string, RuntimeEnvContainer> = new Map<
    string,
    RuntimeEnvContainer
  >();

  public constructor(
    private runtimeFolder: string,
    private opts: PostmanCollectionRunnerClientOption,
    private collection: Collection
  ) {}

  public save = (itemName: string, eventEmitter: any, eventType: "beforeStep" | "afterStep") => {
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
    let runtimeEnvPath = this.generateRuntimeEnvPath(fromStep);
    const previousStep = this.getLastStepName(fromStep);
    let useBeforeStep = true;
    if (!existsSync(runtimeEnvPath)) {
      if (previousStep !== undefined) {
        printWarning(
          `could not found the last runtime env file ${runtimeEnvPath}, try using env file of the previous step '${previousStep}' `
        );
        runtimeEnvPath = this.generateRuntimeEnvPath(previousStep);
        if (!existsSync(runtimeEnvPath)) {
          throw new Error(
            `could not found the runtime env file ${runtimeEnvPath} for the previous step of '${fromStep}' . `
          );
        }
        useBeforeStep = false;
      } else {
        throw new Error(
          `the last runtime env file ${runtimeEnvPath} for step '${fromStep}' did not exist. `
        );
      }
    }
    const runtimeEnvContainer = JSON.parse(
      readFileSync(runtimeEnvPath).toString()
    ) as RuntimeEnvContainer;
    const lastRuntimeEnv = useBeforeStep
      ? runtimeEnvContainer.beforeStep
      : runtimeEnvContainer.afterStep;
    if (!lastRuntimeEnv) {
      throw new Error(
        `could not load last runtime env for step '${fromStep}', please check the file ${runtimeEnvPath} `
      );
    }
    return lastRuntimeEnv;
  };

  private getLastStepName(fromStep: string) {
    const collection = this.collection;
    const fromIndex = this.getStepIndex(collection, fromStep);
    if (fromIndex === 0) {
      return undefined;
    }
    return collection.items.idx(fromIndex - 1).name;
  }

  public repopulateCollectionItems = (from?: string, to?: string) => {
    if (!from && !to) {
      return;
    }
    const collection = this.collection;
    const fromIndex = from ? this.getStepIndex(collection, from) : 0;
    let toIndex = to ? this.getStepIndex(collection, to) : collection.items.count() - 1;

    if (fromIndex > toIndex) {
      throw new Error(
        `the step '${from}' is after the step '${to}', please check the command arguments.`
      );
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
      if (idx < collection.items.count()) items.push(collection.items.idx(idx));
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
      throw new Error(
        `the runtime environment file for step '${stepName}' did not exist in the test scenario.`
      );
    }
    return collection.items.indexOf(item.id);
  };
}
