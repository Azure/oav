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
  testProxy?: string;
  skipValidation?: boolean;
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

  public async run(): Promise<Collection> {
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

    const client = new PostmanCollectionRunnerClient({
      collectionName: scenarioDef.name,
      runId: this.opt.runId,
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
    });

    await runner.execute(scenarioDef);

    let [collection, environment] = client.outputCollection();

    if (this.opt.generateCollection) {
      await this.writeCollectionToJson(scenarioDef.name, collection, environment);
    }

    if (this.opt.runCollection) {
      if (collection.items.find((item) => item.name === PREPARE_FOLDER, collection)) {
        const summary = await this.runCollection({
          collection,
          environment,
          folder: PREPARE_FOLDER,
          reporters: "cli",
        });
        environment = summary.environment;
      }
      for (const scenario of scenarioDef.scenarios) {
        const reportExportPath = path.resolve(
          this.opt.outputFolder,
          `${defaultNewmanReport(this.opt.name, this.opt.runId!, scenario.scenario)}`
        );
        const summary = await this.runCollection({
          collection,
          environment,
          folder: scenario.scenario,
          reporters: "cli",
        });
        await this.postRun(scenario, reportExportPath, summary.environment, summary);
        environment = summary.environment;
      }
      if (collection.items.find((item) => item.name === CLEANUP_FOLDER, collection)) {
        if (!this.opt.skipCleanUp) {
          await this.runCollection({
            collection,
            environment,
            folder: CLEANUP_FOLDER,
            reporters: "cli",
          });
        }
      }
    }

    const operationIdCoverageResult = this.swaggerAnalyzer.calculateOperationCoverage(scenarioDef);
    logger.info(
      `Operation coverage ${(operationIdCoverageResult.coverage * 100).toFixed(2) + "%"} (${
        operationIdCoverageResult.coveredOperationNumber
      }/${operationIdCoverageResult.totalOperationNumber})`
    );
    if (operationIdCoverageResult.uncoveredOperationIds.length > 0) {
      logger.verbose("Uncovered operationIds: ");
      logger.verbose(operationIdCoverageResult.uncoveredOperationIds);
    }

    if (this.opt.html && this.opt.runCollection) {
      await this.generateHtmlReport(scenarioDef);
    }

    return collection;
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
              ...(step.liveValidationResult?.requestValidationResult.errors ?? []),
              ...(step.liveValidationResult?.responseValidationResult.errors ?? []),
            ],
            specFilePath: step.specFilePath,
            operationInfo: step.liveValidationResult?.requestValidationResult.operationInfo ?? {
              operationId: "unknown",
              apiVersion: "unknown",
            },
          };

          // mock
          trafficValidationIssue.operationInfo!.position = {
            line: 0,
            column: 0,
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

          if (step.liveValidationResult?.requestValidationResult.runtimeException) {
            trafficValidationIssue.errors?.push(
              this.convertRuntimeException(
                step.liveValidationResult!.requestValidationResult.runtimeException
              )
            );
          }

          if (step.liveValidationResult?.responseValidationResult.runtimeException) {
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
      `${defaultCollectionFileName(this.opt.name, this.opt.runId!)}`
    );
    const envPath = path.resolve(
      this.opt.outputFolder,
      `${defaultEnvFileName(this.opt.name, this.opt.runId!)}`
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

  private async runCollection(runOptions: NewmanRunOptions) {
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
      swaggerFilePaths: scenario._scenarioDef._swaggerFilePaths,
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
      verbose: this.opt.verbose,
    };

    const reportValidator = inversifyGetInstance(
      NewmanReportValidator,
      newmanReportValidatorOption
    );

    await reportValidator.initialize(scenario);

    await reportValidator.generateReport(newmanReport);

    if (this.opt.skipCleanUp) {
      logger.warn(
        `Notice:the resource group '${runtimeEnv.get("resourceGroupName")}' was not cleaned up.`
      );
    }
  }
}
