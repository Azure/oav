import * as path from "path";
import * as fs from "fs";
import newman from "newman";
import { inject, injectable } from "inversify";
import { Collection, VariableScope } from "postman-collection";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import { ReportGenerator as HtmlReportGenerator } from "../report/generateReport";
import { FileLoader } from "../swagger/fileLoader";
import { getApiVersionFromFilePath, getRandomString, printWarning } from "../util/utils";
import {
  OperationCoverageInfo,
  RuntimeException,
  TrafficValidationIssue,
  TrafficValidationOptions,
  unCoveredOperationsFormat,
} from "../swaggerValidator/trafficValidator";
import { LiveValidationIssue } from "../liveValidation/liveValidator";
import { ApiScenarioLoader, ApiScenarioLoaderOption } from "./apiScenarioLoader";
import { ApiScenarioRunner } from "./apiScenarioRunner";
import { generateMarkdownReportHeader } from "./markdownReport";
import { PostmanCollectionRunnerClient } from "./postmanCollectionRunnerClient";
import {
  ApiScenarioTestResult,
  NewmanReportValidator,
  NewmanReportValidatorOption,
  ValidationLevel,
} from "./newmanReportValidator";
import { SwaggerAnalyzer, SwaggerAnalyzerOption } from "./swaggerAnalyzer";
import { EnvironmentVariables, VariableEnv } from "./variableEnv";
import { parseNewmanReport, RawNewmanReport } from "./newmanReportParser";
import {
  defaultCollectionFileName,
  defaultEnvFileName,
  defaultNewmanDir,
  defaultNewmanReport,
  defaultQualityReportFilePath,
} from "./defaultNaming";
import { DataMasker } from "./dataMasker";
import { Scenario, ScenarioDefinition } from "./apiScenarioTypes";

export interface PostmanCollectionGeneratorOption
  extends ApiScenarioLoaderOption,
    SwaggerAnalyzerOption {
  name: string;
  fileRoot: string;
  scenarioDef: string;
  env: EnvironmentVariables;
  outputFolder: string;
  markdown?: boolean;
  junit?: boolean;
  html?: boolean;
  runCollection: boolean;
  generateCollection: boolean;
  baseUrl: string;
  testProxy?: string;
  validationLevel?: ValidationLevel;
  savePayload?: boolean;
  generateExample?: boolean;
  skipCleanUp?: boolean;
  runId?: string;
  verbose?: boolean;
  devMode?: boolean;
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

    await this.swaggerAnalyzer.initialize();
    for (const it of scenarioDef.requiredVariables) {
      if (this.opt.env[it] === undefined) {
        throw new Error(
          `Missing required variable '${it}', please set variable values in env.json.`
        );
      }
    }
    this.opt.runId = this.opt.runId || generateRunId();
    const oldSkipCleanUp = this.opt.skipCleanUp;
    this.opt.skipCleanUp =
      this.opt.skipCleanUp || scenarioDef.scenarios.filter((s) => s.shareScope).length > 1;

    if (this.opt.markdown) {
      const reportExportPath = path.resolve(
        this.opt.outputFolder,
        `${defaultNewmanDir(this.opt.name, this.opt.runId!)}`
      );
      await this.fileLoader.writeFile(
        path.join(reportExportPath, "report.md"),
        generateMarkdownReportHeader()
      );
    }

    const result: Collection[] = [];

    const client = new PostmanCollectionRunnerClient({
      runId: this.opt.runId,
      baseUrl: this.opt.baseUrl,
      testProxy: this.opt.testProxy,
      verbose: this.opt.verbose,
      skipAuth: this.opt.devMode,
      skipArmCall: this.opt.devMode,
      skipLroPoll: this.opt.devMode,
    });
    const runner = new ApiScenarioRunner({
      jsonLoader: this.apiScenarioLoader.jsonLoader,
      env: this.opt.env,
      client: client,
      resolveVariables: false,
      skipCleanUp: this.opt.skipCleanUp,
    });

    for (let i = 0; i < scenarioDef.scenarios.length; i++) {
      const scenario = scenarioDef.scenarios[i];
      if (i === scenarioDef.scenarios.length - 1 && !oldSkipCleanUp) {
        this.opt.skipCleanUp = oldSkipCleanUp;
        runner.setSkipCleanUp(false);
      }
      await runner.executeScenario(scenario);

      const [collection, runtimeEnv] = client.outputCollection();

      for (let i = 0; i < collection.items.count(); i++) {
        this.longRunningOperationOrderUpdate(collection, i);
      }

      if (this.opt.generateCollection) {
        await this.writeCollectionToJson(scenario, collection, runtimeEnv);
      }

      if (this.opt.runCollection) {
        await this.runCollection(scenario, collection, runtimeEnv);
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

    if (this.opt.html) {
      await this.generateHtmlReport(scenarioDef);
    }

    return result;
  }

  private async generateHtmlReport(scenarioDef: ScenarioDefinition) {
    const trafficValidationResult = new Array<TrafficValidationIssue>();
    const reportExportPath = path.resolve(
      this.opt.outputFolder,
      `${defaultNewmanDir(this.opt.name, this.opt.runId!)}`
    );

    let providerNamespace;

    for (const dir of fs.readdirSync(reportExportPath, { withFileTypes: true })) {
      if (dir.isDirectory()) {
        const report = JSON.parse(
          await this.fileLoader.load(path.join(reportExportPath, dir.name, "report.json"))
        ) as ApiScenarioTestResult;

        providerNamespace = report.providerNamespace;
        for (const step of report.stepResult) {
          const trafficValidationIssue: TrafficValidationIssue = {
            errors: [
              ...step.liveValidationResult!.requestValidationResult.errors,
              ...step.liveValidationResult!.responseValidationResult.errors,
            ],
            specFilePath: step.specFilePath,
            operationInfo: step.liveValidationResult!.requestValidationResult.operationInfo,
          };

          if (this.opt.savePayload) {
            const payloadFilePath = path.join(
              ".",
              dir.name,
              `payloads/${step.stepName}_${step.correlationId}.json`
            );
            trafficValidationIssue.payloadFilePath = payloadFilePath;
          }

          for (const runtimeError of step.runtimeError ?? []) {
            trafficValidationIssue.errors?.push(this.convertRuntimeException(runtimeError));
          }

          if (step.liveValidationResult!.requestValidationResult.runtimeException) {
            trafficValidationIssue.errors?.push(
              this.convertRuntimeException(
                step.liveValidationResult!.requestValidationResult.runtimeException
              )
            );
          }

          if (step.liveValidationResult!.responseValidationResult.runtimeException) {
            trafficValidationIssue.errors?.push(
              this.convertRuntimeException(
                step.liveValidationResult!.responseValidationResult.runtimeException
              )
            );
          }

          trafficValidationResult.push(trafficValidationIssue);
        }
      }
    }

    const operationIdCoverageResult =
      this.swaggerAnalyzer.calculateOperationCoverageBySpec(scenarioDef);

    const operationCoverageResult: OperationCoverageInfo[] = [];
    operationIdCoverageResult.forEach((result, key) => {
      let specPath = this.fileLoader.resolvePath(key);
      if (process.env.REPORT_SPEC_PATH_PREFIX) {
        specPath = path.join(
          process.env.REPORT_SPEC_PATH_PREFIX,
          specPath.substring(specPath.indexOf("specification"))
        );
      }
      operationCoverageResult.push({
        totalOperations: result.totalOperationNumber,
        spec: specPath,
        coverageRate: result.coverage,
        apiVersion: getApiVersionFromFilePath(specPath),
        unCoveredOperations: result.uncoveredOperationIds.length,
        coveredOperaions: result.totalOperationNumber - result.uncoveredOperationIds.length,
        validationFailOperations: trafficValidationResult.filter(
          (it) => key.indexOf(it.specFilePath!) !== -1 && it.errors!.length > 0
        ).length,
        unCoveredOperationsList: result.uncoveredOperationIds.map((id) => {
          return { operationId: id };
        }),
        unCoveredOperationsListGen: Object.values(
          result.uncoveredOperationIds
            .map((id) => {
              return { operationId: id, key: id.split("_")[0] };
            })
            .reduce((res: { [key: string]: unCoveredOperationsFormat }, item) => {
              /* eslint-disable no-unused-expressions */
              res[item.key]
                ? res[item.key].operationIdList.push(item)
                : (res[item.key] = {
                    operationIdList: [item],
                  });
              /* eslint-enable no-unused-expressions */
              return res;
            }, {})
        ),
      });
    });

    const options: TrafficValidationOptions = {
      reportPath: path.resolve(reportExportPath, "report.html"),
      overrideLinkInReport: false,
      sdkPackage: providerNamespace,
    };

    const generator = new HtmlReportGenerator(
      trafficValidationResult,
      operationCoverageResult,
      0,
      options
    );
    await generator.generateHtmlReport();
  }

  private convertRuntimeException(runtimeException: RuntimeException): LiveValidationIssue {
    const ret = {
      code: runtimeException.code,
      pathsInPayload: [],
      severity: 1,
      message: runtimeException.message,
      jsonPathsInPayload: [],
      schemaPath: "",
      source: {
        url: "",
        position: {
          column: 0,
          line: 0,
        },
      },
    };

    return ret as LiveValidationIssue;
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
    scenario: Scenario,
    collection: Collection,
    runtimeEnv: VariableScope
  ) {
    const scenarioName = scenario.scenario;
    const collectionPath = path.resolve(
      this.opt.outputFolder,
      `${defaultCollectionFileName(this.opt.name, this.opt.runId!, scenarioName)}`
    );
    const envPath = path.resolve(
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
    console.log(`Postman collection: ${collectionPath}\nPostman env: ${envPath}`);
  }

  private async runCollection(
    scenario: Scenario,
    collection: Collection,
    runtimeEnv: VariableScope
  ) {
    const scenarioName = scenario.scenario;
    const reportExportPath = path.resolve(
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
            await this.postRun(scenario, reportExportPath, runtimeEnv);
            resolve(_summary);
          });
      });
    };
    await newmanRun();
  }

  private async postRun(scenario: Scenario, reportExportPath: string, runtimeEnv: VariableScope) {
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
    const rawReport = JSON.parse(await this.fileLoader.load(reportExportPath)) as RawNewmanReport;

    // add mask environment secret value
    for (const item of rawReport.environment.values) {
      if (this.dataMasker.maybeSecretKey(item.key)) {
        this.dataMasker.addMaskedValues([item.value]);
      }
    }

    const newmanReport = parseNewmanReport(rawReport);

    const newmanReportValidatorOption: NewmanReportValidatorOption = {
      apiScenarioFilePath: scenario._scenarioDef._filePath,
      swaggerFilePaths: scenario._scenarioDef._swaggerFilePaths,
      reportOutputFilePath: defaultQualityReportFilePath(reportExportPath),
      checkUnderFileRoot: false,
      eraseXmsExamples: false,
      eraseDescription: false,
      markdown: this.opt.markdown,
      junit: this.opt.junit,
      html: this.opt.html,
      baseUrl: this.opt.baseUrl,
      runId: this.opt.runId,
      validationLevel: this.opt.validationLevel,
      generateExample: this.opt.generateExample,
      savePayload: this.opt.savePayload,
      verbose: this.opt.verbose,
    };

    const reportValidator = inversifyGetInstance(
      NewmanReportValidator,
      newmanReportValidatorOption
    );

    await reportValidator.initialize(scenario);

    await reportValidator.generateReport(newmanReport);

    if (this.opt.skipCleanUp) {
      printWarning(
        `Notice:the resource group '${runtimeEnv.get("resourceGroupName")}' was not cleaned up.`
      );
    }
  }
}
