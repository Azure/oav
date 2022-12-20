import * as path from "path";
import * as fs from "fs";
import newman, { NewmanRunOptions, NewmanRunSummary } from "newman";
import { inject, injectable } from "inversify";
import { Collection, VariableScope } from "postman-collection";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import { ReportGenerator as HtmlReportGenerator } from "../report/generateReport";
import { FileLoader } from "../swagger/fileLoader";
import { getApiVersionFromFilePath, getRandomString } from "../util/utils";
import {
  OperationCoverageInfo,
  RuntimeException,
  TrafficValidationIssue,
  TrafficValidationOptions,
  unCoveredOperationsFormat,
} from "../swaggerValidator/trafficValidator";
import { LiveValidationIssue } from "../liveValidation/liveValidator";
import { setDefaultOpts } from "../swagger/loader";
import { logger } from "./logger";
import { ApiScenarioLoader, ApiScenarioLoaderOption } from "./apiScenarioLoader";
import { ApiScenarioRunner } from "./apiScenarioRunner";
import { generateMarkdownReportHeader } from "./markdownReport";
import { PostmanCollectionRunnerClient } from "./postmanCollectionRunnerClient";
import {
  ApiScenarioTestResult,
  NewmanReportValidator,
  NewmanReportValidatorOption,
} from "./newmanReportValidator";
import { SwaggerAnalyzer, SwaggerAnalyzerOption } from "./swaggerAnalyzer";
import { EnvironmentVariables } from "./variableEnv";
import { parseNewmanSummary } from "./newmanReportParser";
import {
  defaultCollectionFileName,
  defaultEnvFileName,
  defaultNewmanDir,
  defaultNewmanReport,
  defaultQualityReportFilePath,
} from "./defaultNaming";
import { DataMasker } from "./dataMasker";
import { Scenario, ScenarioDefinition } from "./apiScenarioTypes";
import { CLEANUP_FOLDER, PREPARE_FOLDER } from "./postmanHelper";

export interface PostmanCollectionGeneratorOption
  extends ApiScenarioLoaderOption,
    SwaggerAnalyzerOption {
  fileRoot: string;
  env: EnvironmentVariables;
  outputFolder: string;
  markdown?: boolean;
  junit?: boolean;
  html?: boolean;
  runCollection: boolean;
  generateCollection: boolean;
  testProxy?: string;
  testProxyAssets?: string;
  calculateCoverage?: boolean;
  skipValidation?: boolean;
  savePayload?: boolean;
  generateExample?: boolean;
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

interface PostmanCollectionRunnerOption extends PostmanCollectionGeneratorOption {
  scenarioFile: string;
  generator: PostmanCollectionGenerator;
}

@injectable()
class PostmanCollectionRunner {
  private scenarioBaseFileLoader: FileLoader;
  public environment: VariableScope;
  private collection: Collection;
  private baseEnvironment?: VariableScope;
  private scenarioDef: ScenarioDefinition;

  constructor(
    @inject(TYPES.opts) private opt: PostmanCollectionRunnerOption,
    private apiScenarioLoader: ApiScenarioLoader,
    private fileLoader: FileLoader,
    private dataMasker: DataMasker,
    private swaggerAnalyzer: SwaggerAnalyzer
  ) {
    this.opt.scenarioFile = this.fileLoader.resolvePath(this.opt.scenarioFile);
    this.scenarioBaseFileLoader = new FileLoader({
      fileRoot: path.dirname(this.opt.scenarioFile),
      checkUnderFileRoot: false,
    });
  }

  public static create(opt: PostmanCollectionRunnerOption) {
    (opt as any).container = undefined;
    return inversifyGetInstance(PostmanCollectionRunner, opt);
  }

  public async run(): Promise<Collection> {
    this.scenarioDef = await this.apiScenarioLoader.load(
      this.opt.scenarioFile,
      this.opt.swaggerFilePaths
    );

    if (this.scenarioDef.scope.endsWith(".yaml") || this.scenarioDef.scope.endsWith(".yml")) {
      const parentScenarioFile = this.scenarioBaseFileLoader.resolvePath(this.scenarioDef.scope);
      if (!this.opt.generator.runnerMap.has(parentScenarioFile)) {
        const runner = PostmanCollectionRunner.create({
          ...this.opt,
          scenarioFile: parentScenarioFile,
        });

        await runner.run();
        this.opt.generator.runnerMap.set(parentScenarioFile, runner);
      }
      this.baseEnvironment = this.opt.generator.runnerMap.get(parentScenarioFile)?.environment;
    }

    await this.doRun();
    return this.collection;
  }

  public async cleanUp(skipCleanUp: boolean) {
    if (this.opt.runCollection) {
      try {
        const foldersToRun = [];
        if (
          !skipCleanUp &&
          this.collection.items.find((item) => item.name === CLEANUP_FOLDER, this.collection)
        ) {
          foldersToRun.push(CLEANUP_FOLDER);
        }

        if (foldersToRun.length === 0) {
          return;
        }

        const summary = await this.doRunCollection({
          collection: this.collection,
          environment: this.environment,
          folder: foldersToRun,
          reporters: "cli",
        });

        // todo add report

        this.environment = summary.environment;
      } catch (err) {
        logger.error(`Error in running collection: ${err}`);
      } finally {
        if (skipCleanUp && this.scenarioDef.scope === "ResourceGroup") {
          logger.warn(
            `Notice: the resource group '${this.environment.get(
              "resourceGroupName"
            )}' was not cleaned up.`
          );
        }
      }
    }
  }

  public async generateReport() {
    if (this.opt.calculateCoverage) {
      const operationIdCoverageResult = this.swaggerAnalyzer.calculateOperationCoverage(
        this.scenarioDef
      );
      logger.info(
        `Operation coverage ${(operationIdCoverageResult.coverage * 100).toFixed(2) + "%"} (${
          operationIdCoverageResult.coveredOperationNumber
        }/${operationIdCoverageResult.totalOperationNumber})`
      );
      if (operationIdCoverageResult.uncoveredOperationIds.length > 0) {
        logger.verbose("Uncovered operationIds: ");
        logger.verbose(operationIdCoverageResult.uncoveredOperationIds);
      }
    }

    if (this.opt.html && this.opt.runCollection) {
      await this.generateHtmlReport();
    }
  }

  private async doRun() {
    await this.swaggerAnalyzer.initialize();
    for (const it of this.scenarioDef.requiredVariables) {
      if (this.opt.env[it] === undefined) {
        throw new Error(
          `Missing required variable '${it}', please set variable values in env.json.`
        );
      }
    }
    this.opt.runId = this.opt.runId || generateRunId();

    if (this.opt.markdown) {
      const reportExportPath = path.resolve(
        this.opt.outputFolder,
        `${defaultNewmanDir(this.scenarioDef.name, this.opt.runId!)}`
      );
      await this.fileLoader.writeFile(
        path.join(reportExportPath, "report.md"),
        generateMarkdownReportHeader()
      );
    }

    await this.generateCollection();

    if (this.opt.generateCollection) {
      await this.writeCollectionToJson(this.scenarioDef.name, this.collection, this.environment);
    }

    if (this.opt.runCollection) {
      try {
        for (let i = 0; i < this.scenarioDef.scenarios.length; i++) {
          const scenario = this.scenarioDef.scenarios[i];

          const foldersToRun = [];
          if (
            i == 0 &&
            this.collection.items.find((item) => item.name === PREPARE_FOLDER, this.collection)
          ) {
            foldersToRun.push(PREPARE_FOLDER);
          }
          foldersToRun.push(scenario.scenario);

          const reportExportPath = path.resolve(
            this.opt.outputFolder,
            `${defaultNewmanReport(this.scenarioDef.name, this.opt.runId!, scenario.scenario)}`
          );
          const summary = await this.doRunCollection({
            collection: this.collection,
            environment: this.environment,
            folder: foldersToRun,
            reporters: "cli",
          });
          await this.postRun(scenario, reportExportPath, summary.environment, summary);

          this.environment = summary.environment;
        }
      } catch (err) {
        logger.error(`Error in running collection: ${err}`);
      }
    }
  }

  private async generateCollection() {
    const client = new PostmanCollectionRunnerClient({
      scenarioFile: this.scenarioDef._filePath,
      collectionName: this.scenarioDef.name,
      runId: this.opt.runId!,
      testProxy: this.opt.testProxy,
      testProxyAssets: this.opt.testProxyAssets,
      verbose: this.opt.verbose,
      skipAuth: this.opt.devMode,
      skipArmCall: this.opt.devMode,
      skipLroPoll: this.opt.devMode,
      jsonLoader: this.apiScenarioLoader.jsonLoader,
    });
    const runner = new ApiScenarioRunner({
      jsonLoader: this.apiScenarioLoader.jsonLoader,
      env: Object.assign(
        {},
        this.opt.env,
        ...(this.baseEnvironment?.values
          ?.filter((v) => !v.key?.startsWith("x_"))
          .map((v) => ({ [v.key!]: v.value })) || [])
      ),
      client: client,
    });

    await runner.execute(this.scenarioDef);

    const [collection, environment] = client.outputCollection();
    this.environment = environment;
    this.collection = collection;
  }

  private async generateHtmlReport() {
    const trafficValidationResult = new Array<TrafficValidationIssue>();
    const reportExportPath = path.resolve(
      this.opt.outputFolder,
      `${defaultNewmanDir(this.scenarioDef.name, this.opt.runId!)}`
    );

    let providerNamespace;

    for (const dir of fs.readdirSync(reportExportPath, { withFileTypes: true })) {
      if (dir.isDirectory()) {
        const report = JSON.parse(
          await this.fileLoader.load(path.join(reportExportPath, dir.name, "report.json"))
        ) as ApiScenarioTestResult;

        providerNamespace = report.providerNamespace;
        for (const r of report.stepResult) {
          const trafficValidationIssue: TrafficValidationIssue = {
            errors: [
              ...(r.liveValidationResult?.requestValidationResult.errors ?? []),
              ...(r.liveValidationResult?.responseValidationResult.errors ?? []),
              ...(r.roundtripValidationResult?.errors ?? []),
            ],
            specFilePath: r.specFilePath,
            operationInfo: r.liveValidationResult?.requestValidationResult.operationInfo ?? {
              operationId: r.operationId,
              apiVersion: report.apiVersion ?? "unknown",
            },
          };

          // mock
          trafficValidationIssue.operationInfo!.position = {
            line: 0,
            column: 0,
          };

          if (this.opt.savePayload) {
            trafficValidationIssue.payloadFilePath = r.payloadPath;
          }

          for (const runtimeError of r.runtimeError ?? []) {
            trafficValidationIssue.errors?.push(this.convertRuntimeException(runtimeError));
          }

          if (r.liveValidationResult?.requestValidationResult.runtimeException) {
            trafficValidationIssue.errors?.push(
              this.convertRuntimeException(
                r.liveValidationResult!.requestValidationResult.runtimeException
              )
            );
          }

          if (r.liveValidationResult?.responseValidationResult.runtimeException) {
            trafficValidationIssue.errors?.push(
              this.convertRuntimeException(
                r.liveValidationResult!.responseValidationResult.runtimeException
              )
            );
          }

          trafficValidationResult.push(trafficValidationIssue);
        }
      }
    }

    const operationIdCoverageResult = this.swaggerAnalyzer.calculateOperationCoverageBySpec(
      this.scenarioDef
    );

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
        validationFailOperations: new Set(
          trafficValidationResult
            .filter((it) => key.indexOf(it.specFilePath!) !== -1 && it.errors!.length > 0)
            .map((t) => t.operationInfo?.operationId)
        ).size,
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
      markdownPath: this.opt.markdown ? path.resolve(reportExportPath, "report.md") : undefined,
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

  private async writeCollectionToJson(
    collectionName: string,
    collection: Collection,
    runtimeEnv: VariableScope
  ) {
    const collectionPath = path.resolve(
      this.opt.outputFolder,
      `${defaultCollectionFileName(collectionName, this.opt.runId!)}`
    );
    const envPath = path.resolve(
      this.opt.outputFolder,
      `${defaultEnvFileName(collectionName, this.opt.runId!)}`
    );
    const env = runtimeEnv.toJSON();
    env.name = collectionName + ".env";
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

    logger.info(`generate collection successfully!`);
    logger.info(`Postman collection: ${collectionPath}`);
    logger.info(`Postman env: ${envPath}`);
  }

  private async doRunCollection(runOptions: NewmanRunOptions) {
    const newmanRun = async () =>
      new Promise<NewmanRunSummary>((resolve, reject) => {
        newman.run(runOptions, function (err, summary) {
          if (summary.run.failures.length > 0) {
            process.exitCode = 1;
          }
          if (err) {
            logger.error(`collection run failed. ${err}`);
            reject(err);
          } else {
            logger.info("collection run complete!");
            resolve(summary);
          }
        });
      });
    return await newmanRun();
  }

  private async postRun(
    scenario: Scenario,
    reportExportPath: string,
    runtimeEnv: VariableScope,
    summary: NewmanRunSummary
  ) {
    const keys = await this.swaggerAnalyzer.getAllSecretKey();
    const values: string[] = [];
    for (const [k, v] of Object.entries(runtimeEnv.syncVariablesTo())) {
      if (this.dataMasker.maybeSecretKey(k)) {
        values.push(v as string);
      }
    }
    this.dataMasker.addMaskedValues(values);
    this.dataMasker.addMaskedKeys(keys);

    // add mask environment secret value
    for (const item of summary.environment.values.members) {
      if (this.dataMasker.maybeSecretKey(item.key)) {
        this.dataMasker.addMaskedValues([item.value]);
      }
    }

    const newmanReport = parseNewmanSummary(summary as any);

    const newmanReportValidatorOption: NewmanReportValidatorOption = {
      apiScenarioFilePath: scenario._scenarioDef._filePath,
      reportOutputFilePath: defaultQualityReportFilePath(reportExportPath),
      checkUnderFileRoot: false,
      eraseXmsExamples: false,
      eraseDescription: false,
      markdown: this.opt.markdown,
      junit: this.opt.junit,
      html: this.opt.html,
      armEndpoint: this.opt.env.armEndpoint,
      runId: this.opt.runId,
      skipValidation: this.opt.skipValidation,
      generateExample: this.opt.generateExample,
      savePayload: this.opt.savePayload,
    };

    const reportValidator = inversifyGetInstance(
      NewmanReportValidator,
      newmanReportValidatorOption
    );

    await reportValidator.initialize(scenario);

    await reportValidator.generateReport(newmanReport);
  }
}

@injectable()
export class PostmanCollectionGenerator {
  public runnerMap = new Map<string, PostmanCollectionRunner>();

  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(@inject(TYPES.opts) private opt: PostmanCollectionGeneratorOption) {
    setDefaultOpts(opt, {
      runId: generateRunId(),
    });
  }

  public async run(scenarioFile: string, skipCleanUp: boolean = false): Promise<Collection> {
    const runner = PostmanCollectionRunner.create({
      scenarioFile: scenarioFile,
      generator: this,
      ...this.opt,
    });

    const collection = await runner.run();

    await runner.cleanUp(skipCleanUp);

    await runner.generateReport();

    return collection;
  }

  public async cleanUpAll(skipCleanUp: boolean = false): Promise<void> {
    for (const runner of this.runnerMap.values()) {
      await runner.cleanUp(skipCleanUp);
      await runner.generateReport();
    }
    this.runnerMap.clear();
  }
}
