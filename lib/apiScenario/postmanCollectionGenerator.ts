import { resolve } from "path";
import newman from "newman";
import { inject, injectable } from "inversify";
import { Collection, VariableScope } from "postman-collection";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import { FileLoader } from "../swagger/fileLoader";
import { getRandomString, printWarning } from "../util/utils";
import { ApiScenarioLoader, ApiScenarioLoaderOption } from "./apiScenarioLoader";
import { ApiScenarioRunner } from "./apiScenarioRunner";
import { generateMarkdownReportHeader } from "./markdownReport";
import { PostmanCollectionRunnerClient } from "./postmanCollectionRunnerClient";
import { ValidationLevel } from "./reportGenerator";
import { SwaggerAnalyzer, SwaggerAnalyzerOption } from "./swaggerAnalyzer";
import { EnvironmentVariables, VariableEnv } from "./variableEnv";
import { NewmanReportAnalyzer, NewmanReportAnalyzerOption } from "./postmanReportAnalyzer";
import { NewmanReport } from "./postmanReportParser";
import {
  defaultCollectionFileName,
  defaultEnvFileName,
  defaultNewmanReport,
} from "./defaultNaming";
import { DataMasker } from "./dataMasker";

export interface PostmanCollectionGeneratorOption
  extends ApiScenarioLoaderOption,
    SwaggerAnalyzerOption {
  name: string;
  fileRoot: string;
  scenarioDef: string;
  env: EnvironmentVariables;
  outputFolder: string;
  markdownReportPath?: string;
  junitReportPath?: string;
  runCollection: boolean;
  generateCollection: boolean;
  baseUrl: string;
  testProxy?: string;
  validationLevel?: ValidationLevel;
  skipCleanUp?: boolean;
  runId?: string;
  verbose?: boolean;
}

export const generateRunId = (): string => {
  const today = new Date();
  const yyyy = today.getFullYear().toString();
  const MM = pad(today.getMonth() + 1, 2);
  const dd = pad(today.getDate(), 2);
  const hh = pad(today.getHours(), 2);
  const mm = pad(today.getMinutes(), 2);
  const id = getRandomString();
  return yyyy + MM + dd + hh + mm + "-" + id;
};

function pad(number: number, length: number) {
  let str = "" + number;
  while (str.length < length) {
    str = "0" + str;
  }
  return str;
}

@injectable()
export class PostmanCollectionGenerator {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opt: PostmanCollectionGeneratorOption,
    private apiScenarioLoader: ApiScenarioLoader,
    private fileLoader: FileLoader,
    private dataMasker: DataMasker,
    private swaggerAnalyzer: SwaggerAnalyzer
  ) {}

  public async run(): Promise<Collection[]> {
    const scenarioDef = await this.apiScenarioLoader.load(this.opt.scenarioDef);

    await this.swaggerAnalyzer.initialize(this.opt.swaggerFilePaths);
    for (const it of scenarioDef.requiredVariables) {
      if (this.opt.env[it] === undefined) {
        throw new Error(
          `Missing required variable '${it}', please set variable values in env.json.`
        );
      }
    }
    this.opt.runId = this.opt.runId || generateRunId();
    this.opt.skipCleanUp =
      this.opt.skipCleanUp || scenarioDef.scenarios.filter((s) => s.shareScope).length > 1;

    if (this.opt.markdownReportPath) {
      await this.fileLoader.writeFile(this.opt.markdownReportPath, generateMarkdownReportHeader());
    }

    const result: Collection[] = [];

    const client = new PostmanCollectionRunnerClient({
      apiScenarioFileName: this.opt.name,
      apiScenarioFilePath: this.opt.scenarioDef,
      runId: this.opt.runId,
      baseUrl: this.opt.baseUrl,
      testProxy: this.opt.testProxy,
      verbose: this.opt.verbose,
      swaggerFilePaths: this.opt.swaggerFilePaths,
    });
    const runner = new ApiScenarioRunner({
      jsonLoader: this.apiScenarioLoader.jsonLoader,
      env: this.opt.env,
      client: client,
      resolveVariables: false,
      skipCleanUp: this.opt.skipCleanUp,
    });

    for (const scenario of scenarioDef.scenarios) {
      await runner.executeScenario(scenario);

      const [collection, runtimeEnv] = client.outputCollection();

      for (let i = 0; i < collection.items.count(); i++) {
        this.longRunningOperationOrderUpdate(collection, i);
      }

      if (this.opt.generateCollection) {
        await this.writeCollectionToJson(scenario.scenario, collection, runtimeEnv);
      }

      if (this.opt.runCollection) {
        await this.runCollection(scenario.scenario, collection, runtimeEnv);
      }

      result.push(collection);
    }
    const operationIdCoverageResult = this.swaggerAnalyzer.calculateOperationCoverage(scenarioDef);
    console.log(
      `Operation coverage ${(operationIdCoverageResult.coverage * 100).toFixed(2) + "%"} (${
        operationIdCoverageResult.coveredOperationNumber
      }/${operationIdCoverageResult.totalOperationNumber})`
    );
    if (this.opt.verbose) {
      if (operationIdCoverageResult.uncoveredOperationIds.length > 0) {
        console.log("Uncovered operationIds: ");
        console.log(operationIdCoverageResult.uncoveredOperationIds);
      }
    }

    return result;
  }

  private longRunningOperationOrderUpdate(collection: Collection, i: number) {
    if (collection.items.idx(i).name.search("poller$") !== -1) {
      const env = new VariableEnv();
      const nextRequestName =
        i + 2 < collection.items.count() ? `'${collection.items.idx(i + 2).name}'` : "null";
      env.setBatchEnv({ nextRequest: nextRequestName });
      const exec = collection.items.idx(i).events.idx(0).script.toSource() as string;
      collection.items
        .idx(i)
        .events.idx(0)
        .update({
          script: {
            id: getRandomString(),
            type: "text/javascript",
            exec: env.resolveString(exec),
          },
        });
    }
  }

  private async writeCollectionToJson(
    scenarioName: string,
    collection: Collection,
    runtimeEnv: VariableScope
  ) {
    const collectionPath = resolve(
      this.opt.outputFolder,
      `${defaultCollectionFileName(this.opt.name, this.opt.runId!, scenarioName)}`
    );
    const envPath = resolve(
      this.opt.outputFolder,
      `${defaultEnvFileName(this.opt.name, this.opt.runId!, scenarioName)}`
    );
    const env = runtimeEnv.toJSON();
    env.name = scenarioName + ".env";
    env._postman_variable_scope = "environment";
    await this.fileLoader.writeFile(envPath, JSON.stringify(env, null, 2));
    await this.fileLoader.writeFile(collectionPath, JSON.stringify(collection.toJSON(), null, 2));

    const values: string[] = [];
    for (const [k, v] of Object.entries(runtimeEnv.syncVariablesTo())) {
      if (this.dataMasker.maybeSecretKey(k)) {
        values.push(v as string);
      }
    }
    this.dataMasker.addMaskedValues(values);

    console.log(`\ngenerate collection successfully!`);
    console.log(`Postman collection: '${collectionPath}'. Postman env: '${envPath}' `);
    console.log(`Command: newman run ${collectionPath} -e ${envPath} -r 'json,cli'`);
  }

  private async runCollection(
    scenarioName: string,
    collection: Collection,
    runtimeEnv: VariableScope
  ) {
    const reportExportPath = resolve(
      this.opt.outputFolder,
      `${defaultNewmanReport(this.opt.name, this.opt.runId!, scenarioName)}`
    );
    const newmanRun = async () => {
      return new Promise((resolve) => {
        newman
          .run(
            {
              collection: collection,
              environment: runtimeEnv,
              reporters: ["cli", "json"],
              reporter: { json: { export: reportExportPath } },
            },
            function (err, summary) {
              if (summary.run.failures.length > 0) {
                process.exitCode = 1;
              }
              if (err) {
                console.log(`collection run failed. ${err}`);
              }
              console.log("collection run complete!");
            }
          )
          .on("done", async (_err, _summary) => {
            const keys = await this.swaggerAnalyzer.getAllSecretKey();
            const values: string[] = [];
            for (const [k, v] of Object.entries(runtimeEnv.syncVariablesTo())) {
              if (this.dataMasker.maybeSecretKey(k)) {
                values.push(v as string);
              }
            }
            this.dataMasker.addMaskedValues(values);
            this.dataMasker.addMaskedKeys(keys);
            // read content and upload. mask newman report.
            const newmanReport = JSON.parse(
              await this.fileLoader.load(reportExportPath)
            ) as NewmanReport;

            // add mask environment secret value
            for (const item of newmanReport.environment.values) {
              if (this.dataMasker.maybeSecretKey(item.key)) {
                this.dataMasker.addMaskedValues([item.value]);
              }
            }
            const opts: NewmanReportAnalyzerOption = {
              newmanReportFilePath: reportExportPath,
              markdownReportPath: this.opt.markdownReportPath,
              junitReportPath: this.opt.junitReportPath,
              runId: this.opt.runId,
              swaggerFilePaths: this.opt.swaggerFilePaths,
              validationLevel: this.opt.validationLevel,
              verbose: this.opt.verbose,
            };
            const reportAnalyzer = inversifyGetInstance(NewmanReportAnalyzer, opts);
            await reportAnalyzer.analyze();
            if (this.opt.skipCleanUp) {
              printWarning(
                `Notice:the resource group '${runtimeEnv.get(
                  "resourceGroupName"
                )}' was not cleaned up.`
              );
            }
            resolve(_summary);
          });
      });
    };
    await newmanRun();
  }
}
