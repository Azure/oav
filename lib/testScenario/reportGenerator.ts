import * as path from "path";
import * as uuid from "uuid";
import * as _ from "lodash";
import { injectable, inject } from "inversify";
import { ExampleQualityValidator } from "../exampleQualityValidator/exampleQualityValidator";
import { setDefaultOpts } from "../swagger/loader";
import {
  findNearestReadmeDir,
  getApiVersionFromSwaggerFile,
  getProviderFromFilePath,
} from "../util/utils";
import { SeverityString } from "../util/severity";
import { SwaggerAnalyzer } from "./swaggerAnalyzer";
import { DataMasker } from "./dataMasker";
import { defaultQualityReportFilePath } from "./defaultNaming";
import { FileLoader } from "./../swagger/fileLoader";
import { TYPES } from "./../inversifyUtils";
import { SwaggerExample } from "./../swagger/swaggerTypes";
import { TestResourceLoader, TestResourceLoaderOption } from "./testResourceLoader";
import { NewmanReportParser, NewmanReportParserOption } from "./postmanReportParser";
import {
  RawReport,
  RawExecution,
  TestDefinitionFile,
  TestStep,
  TestStepRestCall,
} from "./testResourceTypes";
import { VariableEnv } from "./variableEnv";
import { getJsonPatchDiff } from "./diffUtils";
import { BlobUploader, BlobUploaderOption } from "./blobUploader";
import { generateMarkdownReport } from "./markdownReport";
import { JUnitReporter } from "./junitReport";

interface GeneratedExample {
  exampleFilePath: string;
  step: string;
  operationId: string;
  example: SwaggerExample;
}

export interface TestScenarioResult {
  testScenarioFilePath: string;
  readmeFilePath?: string;
  swaggerFilePaths: string[];
  tag?: string;

  // New added fields
  environment?: string;
  armEnv?: string;
  subscriptionId?: string;
  rootPath?: string;
  providerNamespace?: string;
  apiVersion?: string;
  startTime?: string;
  endTime?: string;
  runId?: string;
  repository?: string;
  branch?: string;
  commitHash?: string;
  armEndpoint: string;
  testScenarioName?: string;
  stepResult: StepResult[];
}

export interface StepResult {
  statusCode: number;
  exampleFilePath?: string;
  example?: SwaggerExample;
  operationId: string;
  runtimeError?: RuntimeError[];
  responseDiffResult?: ResponseDiffItem[];
  liveValidationResult?: any;
  stepValidationResult?: any;
  correlationId?: string;
  stepName: string;
}

export interface RuntimeError {
  code: string;
  message: string;
  detail: string;
  severity: SeverityString;
}

export interface ResponseDiffItem {
  code: string;
  jsonPath: string;
  severity: SeverityString;
  message: string;
  detail: string;
}

export type ValidationLevel = "request-check" | "consistency-check";

export interface ReportGeneratorOption
  extends NewmanReportParserOption,
    TestResourceLoaderOption,
    BlobUploaderOption {
  testDefFilePath: string;
  reportOutputFilePath?: string;
  markdownReportPath?: string;
  junitReportPath?: string;
  testScenarioName?: string;
  runId?: string;
  validationLevel?: ValidationLevel;
}

@injectable()
export class ReportGenerator {
  private exampleQualityValidator: ExampleQualityValidator;
  private swaggerExampleQualityResult: TestScenarioResult;
  private testDefFile: TestDefinitionFile | undefined;
  private operationIds: Set<string>;
  private rawReport: RawReport | undefined;
  private fileRoot: string;
  private recording: Map<string, RawExecution>;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: ReportGeneratorOption,
    private postmanReportParser: NewmanReportParser,
    private testResourceLoader: TestResourceLoader,
    private fileLoader: FileLoader,
    private blobUploader: BlobUploader,
    private dataMasker: DataMasker,
    private swaggerAnalyzer: SwaggerAnalyzer,
    private junitReporter: JUnitReporter
  ) {
    setDefaultOpts(this.opts, {
      newmanReportFilePath: "",
      reportOutputFilePath: defaultQualityReportFilePath(this.opts.newmanReportFilePath),
      enableBlobUploader: false,
      blobConnectionString: "",
      testDefFilePath: "",
      runId: uuid.v4(),
      validationLevel: "consistency-check",
    });
    const swaggerFileAbsolutePaths = this.opts.swaggerFilePaths!.map((it) => path.resolve(it));
    this.exampleQualityValidator = ExampleQualityValidator.create({
      swaggerFilePaths: [...swaggerFileAbsolutePaths],
    });
    this.recording = new Map<string, RawExecution>();
    this.operationIds = new Set<string>();
    this.fileRoot = findNearestReadmeDir(this.opts.testDefFilePath) || "/";

    this.swaggerExampleQualityResult = {
      testScenarioFilePath: path.relative(this.fileRoot, this.opts.testDefFilePath),
      swaggerFilePaths: this.opts.swaggerFilePaths!.map((it) => path.relative(this.fileRoot, it)),
      providerNamespace: getProviderFromFilePath(this.opts.testDefFilePath),
      apiVersion: getApiVersionFromSwaggerFile(this.opts.swaggerFilePaths![0]),
      runId: this.opts.runId,
      rootPath: this.fileRoot,
      repository: process.env.SPEC_REPOSITORY,
      branch: process.env.SPEC_BRANCH,
      commitHash: process.env.COMMIT_HASH,
      environment: process.env.ENVIRONMENT || "test",
      testScenarioName: this.opts.testScenarioName,
      armEndpoint: "https://management.azure.com",
      stepResult: [],
    };
    this.testDefFile = undefined;
  }

  public async initialize() {
    this.rawReport = await this.postmanReportParser.generateRawReport(
      this.opts.newmanReportFilePath
    );
  }

  public async generateTestScenarioResult(rawReport: RawReport) {
    await this.initialize();
    const variables = rawReport.variables;
    this.swaggerExampleQualityResult.startTime = new Date(rawReport.timings.started).toISOString();
    this.swaggerExampleQualityResult.endTime = new Date(rawReport.timings.completed).toISOString();
    this.swaggerExampleQualityResult.subscriptionId = variables.subscriptionId;
    for (const it of rawReport.executions) {
      if (it.annotation === undefined) {
        continue;
      }
      if (it.annotation.type === "simple" || it.annotation.type === "LRO") {
        const runtimeError = [];
        const generatedExample = this.generateExample(it, variables, rawReport);
        const matchedStep = this.getMatchedStep(it.annotation.step) as TestStepRestCall;
        if (
          Math.floor(it.response.statusCode / 200) !== 1 &&
          it.response.statusCode !== matchedStep.statusCode
        ) {
          runtimeError.push(this.getRuntimeError(it));
        }
        if (matchedStep === undefined) {
          continue;
        }
        // validate real payload.
        const roundtripErrors = (
          await this.exampleQualityValidator.validateExternalExamples([
            {
              exampleFilePath: generatedExample.exampleFilePath,
              example: generatedExample.example,
              operationId: matchedStep.operationId,
            },
          ])
        ).map((it) => _.omit(it, ["exampleName", "exampleFilePath"]));
        const correlationId = it.response.headers["x-ms-correlation-request-id"];
        const responseDiffResult: ResponseDiffItem[] =
          this.opts.validationLevel === "consistency-check"
            ? await this.exampleResponseDiff(generatedExample, matchedStep)
            : [];
        this.swaggerExampleQualityResult.stepResult.push({
          exampleFilePath: generatedExample.exampleFilePath,
          operationId: it.annotation.operationId,
          runtimeError,
          responseDiffResult: responseDiffResult,
          stepValidationResult: roundtripErrors,
          correlationId: correlationId,
          statusCode: it.response.statusCode,
          stepName: it.annotation.step,
        });
        this.recording.set(correlationId, it);
      }
    }
  }

  public async generateExampleQualityReport() {
    if (this.opts.reportOutputFilePath !== undefined) {
      console.log(`Write generated report file: ${this.opts.reportOutputFilePath}`);
      await this.fileLoader.writeFile(
        this.opts.reportOutputFilePath,
        JSON.stringify(this.swaggerExampleQualityResult, null, 2)
      );
      if (this.opts.enableBlobUploader) {
        const provider = getProviderFromFilePath(this.opts.reportOutputFilePath) || "";
        const idx = this.opts.reportOutputFilePath.indexOf(provider);
        const blobPath = this.opts.reportOutputFilePath.substr(
          idx,
          this.opts.blobConnectionString?.length
        );
        const secretValues: string[] = [];
        for (const [k, v] of Object.entries(this.rawReport?.variables)) {
          if (this.dataMasker.maybeSecretKey(k)) {
            secretValues.push(v as string);
          }
        }
        this.dataMasker.addMaskedValues(secretValues);
        this.dataMasker.addMaskedKeys(await this.swaggerAnalyzer.getAllSecretKey());

        // mask report here.
        await this.blobUploader.uploadContent(
          "report",
          blobPath,
          this.dataMasker.jsonStringify(this.swaggerExampleQualityResult)
        );

        await this.blobUploader.uploadContent(
          "reportforpipeline",
          blobPath,
          this.dataMasker.jsonStringify(this.swaggerExampleQualityResult)
        );

        for (const [correlationId, v] of this.recording) {
          const payloadBlobPath = `${path.dirname(blobPath)}/${correlationId}.json`;
          await this.blobUploader.uploadContent(
            "payload",
            payloadBlobPath,
            this.dataMasker.jsonStringify(v)
          );
        }
      }
    }
    console.log(JSON.stringify(this.swaggerExampleQualityResult, null, 2));
  }

  public async generateMarkdownQualityReport() {
    if (this.opts.markdownReportPath) {
      await this.fileLoader.appendFile(
        this.opts.markdownReportPath,
        generateMarkdownReport(this.swaggerExampleQualityResult)
      );
    }
  }

  public async generateJUnitReport() {
    if (this.opts.junitReportPath) {
      await this.junitReporter.addSuiteToBuild(
        this.swaggerExampleQualityResult,
        this.opts.junitReportPath
      );
    }
  }

  private generateExample(
    it: RawExecution,
    variables: any,
    rawReport: RawReport
  ): GeneratedExample {
    const example: any = {};
    if (it.annotation.operationId !== undefined) {
      this.operationIds.add(it.annotation.operationId);
    }
    example.parameters = this.generateParametersFromQuery(variables, it);
    try {
      _.extend(example.parameters, { parameters: JSON.parse(it.request.body) });
      // eslint-disable-next-line no-empty
    } catch (err) {}
    const resp: any = this.parseRespBody(it);
    example.responses = {};
    _.extend(example.responses, resp);
    const exampleFilePath = path.relative(
      this.fileRoot,
      path.resolve(this.opts.testDefFilePath, it.annotation.exampleName)
    );
    const generatedGetExecution = this.findGeneratedGetExecution(it, rawReport);
    if (generatedGetExecution.length > 0) {
      const getResp = this.parseRespBody(generatedGetExecution[0]);
      _.extend(example.responses, getResp);
    }
    return {
      exampleFilePath: exampleFilePath,
      example,
      step: it.annotation.step,
      operationId: it.annotation.operationId,
    };
  }

  private async exampleResponseDiff(
    example: GeneratedExample,
    matchedStep: TestStep
  ): Promise<ResponseDiffItem[]> {
    let res: ResponseDiffItem[] = [];
    if (matchedStep?.type === "restCall") {
      if (example.example.responses[matchedStep.statusCode] !== undefined) {
        res = res.concat(
          await this.responseDiff(
            example.example.responses[matchedStep.statusCode]?.body || {},
            matchedStep.responseExpected,
            this.rawReport!.variables,
            `/${matchedStep.statusCode}/body`,
            matchedStep.operation.responses[matchedStep.statusCode].schema
          )
        );
      }
    }
    return res;
  }

  private async responseDiff(
    resp: any,
    expectedResp: any,
    variables: any,
    jsonPathPrefix: string,
    schema: any
  ): Promise<ResponseDiffItem[]> {
    const env = new VariableEnv();
    env.setBatch(variables);
    try {
      const ignoredKeys = [/\/body\/id/, /\/body\/location/, /date/i];
      const ignoreValuePattern = [/\d{4}-[01]\d-[0-3]\dT[0-2]\d:[0-5]\d:[0-5]\d(?:\.\d+)?Z?/];
      const expected = env.resolveObjectValues(expectedResp);
      const delta: ResponseDiffItem[] = getJsonPatchDiff(expected, resp, {
        includeOldValue: true,
        minimizeDiff: false,
      })
        .map((it: any) => {
          const ret: ResponseDiffItem = {
            code: "",
            jsonPath: "",
            severity: "Error",
            message: "",
            detail: "",
          };
          const jsonPath: string = it.remove || it.add || it.replace;
          const propertySchema = this.swaggerAnalyzer.findSchemaByJsonPointer(
            jsonPath,
            schema,
            resp
          );
          if (propertySchema["x-ms-secret"] === true) {
            return undefined;
          }
          if (it.remove !== undefined) {
            ret.code = "RESPONSE_MISSING_VALUE";
            ret.jsonPath = jsonPathPrefix + it.remove;
            ret.severity = "Error";
            ret.message = `The response value is missing. Path: ${
              ret.jsonPath
            }. Expected: ${this.dataMasker.jsonStringify(it.oldValue)}. Actual: undefined`;
          } else if (it.add !== undefined) {
            ret.code = "RESPONSE_ADDITIONAL_VALUE";
            ret.jsonPath = jsonPathPrefix + it.add;
            ret.severity = "Error";
            ret.message = `Return additional response value. Path: ${
              ret.jsonPath
            }. Expected: undefined. Actual: ${this.dataMasker.jsonStringify(it.value)}`;
          } else if (it.replace !== undefined) {
            ret.code = "RESPONSE_INCONSISTENT_VALUE";
            ret.jsonPath = jsonPathPrefix + it.replace;
            // Ignore diff when propertySchema readonly is true. When property is readonly, it's probably a random generated value which updated dynamically per request.
            if (propertySchema.readOnly === true) {
              return undefined;
            }
            ret.severity = "Error";
            ret.message = `The actual response value is different from example. Path: ${
              ret.jsonPath
            }. Expected: ${this.dataMasker.jsonStringify(
              it.oldValue
            )}. Actual: ${this.dataMasker.jsonStringify(it.value)}`;
          }
          ret.detail = this.dataMasker.jsonStringify(it);
          if (
            ignoredKeys.some((key) => ret.jsonPath.search(key) !== -1) ||
            (ret.code === "RESPONSE_INCONSISTENT_VALUE" &&
              typeof it.value === "string" &&
              ignoreValuePattern.some((valuePattern) => it.value.search(valuePattern) !== -1))
          ) {
            return undefined;
          }
          return ret;
        })
        .filter((it) => it !== undefined) as ResponseDiffItem[];
      return delta;
    } catch (err) {
      console.log(err);
    }
    return [];
  }

  private getMatchedStep(stepName: string): TestStep | undefined {
    for (const it of this.testDefFile?.prepareSteps ?? []) {
      if (stepName === it.step) {
        return it;
      }
    }
    for (const testScenario of this.testDefFile?.testScenarios ?? []) {
      for (const step of testScenario.steps) {
        if (stepName === step.step) {
          return step;
        }
      }
    }
    return undefined;
  }
  private findGeneratedGetExecution(it: RawExecution, rawReport: RawReport) {
    if (it.annotation.type === "LRO") {
      const finalGet = rawReport.executions.filter(
        (execution) =>
          execution.annotation &&
          execution.annotation.lro_item_name === it.annotation.itemName &&
          execution.annotation.type === "generated-get"
      );
      return finalGet;
    }
    return [];
  }

  private getRuntimeError(it: RawExecution): RuntimeError {
    const ret: RuntimeError = {
      code: "",
      message: "",
      severity: "Error",
      detail: this.dataMasker.jsonStringify(it.response.body),
    };
    const responseObj = this.dataMasker.jsonParse(it.response.body);
    ret.code = `RUNTIME_ERROR`;
    ret.message = `code: ${responseObj?.error?.code}, message: ${responseObj?.error?.message}`;
    return ret;
  }

  public async generateReport() {
    if (this.opts.testDefFilePath !== undefined) {
      this.testDefFile = await this.testResourceLoader.load(this.opts.testDefFilePath);
    }
    await this.initialize();
    await this.generateTestScenarioResult(this.rawReport!);
    await this.generateExampleQualityReport();
    await this.generateMarkdownQualityReport();
    await this.generateJUnitReport();
  }

  private parseRespBody(it: RawExecution) {
    const resp: any = {};
    try {
      resp[it.response.statusCode] = { body: JSON.parse(it.response.body) };
    } catch (err) {
      resp[it.response.statusCode] = { body: it.response.body };
    }
    return resp;
  }

  private generateParametersFromQuery(variables: any, execution: RawExecution) {
    const ret: any = {};
    for (const [k, v] of Object.entries(variables)) {
      if (typeof v === "string") {
        if (execution.request.url.includes(v as string)) {
          ret[k] = v;
        }
      }
    }
    return ret;
  }
}
