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
    @inject(TYPES.opts) private opts: PostmanCollectionGeneratorOption,
    private apiScenarioLoader: ApiScenarioLoader,
    private fileLoader: FileLoader,
    private dataMasker: DataMasker,
    private swaggerAnalyzer: SwaggerAnalyzer
  ) {}

  public async run(): Promise<Collection[]> {
    const scenarioDef = await this.apiScenarioLoader.load(this.opts.scenarioDef);

    await this.swaggerAnalyzer.initialize(this.opts.swaggerFilePaths);
    for (const it of scenarioDef.requiredVariables) {
      if (this.opts.env[it] === undefined) {
        throw new Error(
          `Missing required variable '${it}', please set variable values in env.json.`
        );
      }
    }
    this.opts.runId = this.opts.runId || generateRunId();
    if (this.opts.markdownReportPath) {
      await this.fileLoader.writeFile(this.opts.markdownReportPath, generateMarkdownReportHeader());
    }

    const result: Collection[] = [];

    const client = new PostmanCollectionRunnerClient({
      apiScenarioFileName: this.opts.name,
      apiScenarioFilePath: this.opts.scenarioDef,
      runId: this.opts.runId,
      baseUrl: this.opts.baseUrl,
      testProxy: this.opts.testProxy,
      verbose: this.opts.verbose,
      swaggerFilePaths: this.opts.swaggerFilePaths,
    });
    const runner = new ApiScenarioRunner({
      jsonLoader: this.apiScenarioLoader.jsonLoader,
      env: this.opts.env,
      client: client,
      resolveVariables: false,
      skipCleanUp: this.opts.skipCleanUp,
    });

    for (const scenario of scenarioDef.scenarios) {
      client.setOpt({
        apiScenarioName: scenario.scenario,
      });

      await runner.executeScenario(scenario);

      const [collection, runtimeEnv] = client.outputCollection();

      for (let i = 0; i < collection.items.count(); i++) {
        this.longRunningOperationOrderUpdate(collection, i);
      }

      if (this.opts.generateCollection) {
        await this.writeCollectionToJson(scenario.scenario, collection, runtimeEnv);
      }

      if (this.opts.runCollection) {
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
    if (this.opts.verbose) {
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
      this.opts.outputFolder,
      `${defaultCollectionFileName(this.opts.name, this.opts.runId!, scenarioName)}`
    );
    const envPath = resolve(
      this.opts.outputFolder,
      `${defaultEnvFileName(this.opts.name, this.opts.runId!, scenarioName)}`
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
      process.cwd(),
      "newman",
      `${defaultNewmanReport(this.opts.name, this.opts.runId!, scenarioName)}`
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
              markdownReportPath: this.opts.markdownReportPath,
              junitReportPath: this.opts.junitReportPath,
              runId: this.opts.runId,
              swaggerFilePaths: this.opts.swaggerFilePaths,
              validationLevel: this.opts.validationLevel,
              verbose: this.opts.verbose,
            };
            const reportAnalyzer = inversifyGetInstance(NewmanReportAnalyzer, opts);
            await reportAnalyzer.analyze();
            if (this.opts.skipCleanUp) {
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
