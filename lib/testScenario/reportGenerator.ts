import * as path from "path";
import * as uuid from "uuid";
import * as _ from "lodash";
import { injectable, inject } from "inversify";
import { ExampleQualityValidator } from "../exampleQualityValidator/exampleQualityValidator";
import { setDefaultOpts } from "../swagger/loader";
import { Severity } from "../util/severity";
import {
  findNearestReadmeDir,
  getApiVersionFromSwaggerFile,
  getProviderFromFilePath,
} from "../util/utils";
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
  JsonPatchOp,
  TestStepRestCall,
} from "./testResourceTypes";
import { VariableEnv } from "./variableEnv";
import { getJsonPatchDiff } from "./diffUtils";
import { BlobUploader, BlobUploaderOption } from "./blobUploader";

interface GeneratedExample {
  exampleFilePath: string;
  step: string;
  operationId: string;
  example: SwaggerExample;
}

interface TestScenarioResult {
  testScenario: {
    testScenarioFilePath: string;
    readmeFilePath?: string;
    swaggerFilePaths: string[];
    tag?: string;

    // New added fields
    environment?: string;
    armEnv?: string;
    subscriptionId?: string;
    fileRoot?: string;
    resourceProvider?: string;
    apiVersion?: string;
    startTime?: string;
    endTime?: string;
    runId?: string;
    repository?: string;
    branch?: string;
    commitHash?: string;
  };
  stepResult: { [step: string]: StepResult };
}

interface StepResult {
  exampleFilePath?: string;
  example?: SwaggerExample;
  operationId: string;
  runtimeError?: HttpError;
  responseDiffResult?: { [statusCode: number]: JsonPatchOp[] };
  liveValidationResult?: any;
  stepValidationResult?: any;
  correlationId?: string;
}

interface HttpError {
  statusCode: number;
  rawExecution: RawExecution;
}

export interface ReportGeneratorOption
  extends NewmanReportParserOption,
    TestResourceLoaderOption,
    BlobUploaderOption {
  testDefFilePath: string;
  reportOutputFilePath?: string;
  runId?: string;
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
    private swaggerAnalyzer: SwaggerAnalyzer
  ) {
    setDefaultOpts(this.opts, {
      newmanReportFilePath: "",
      reportOutputFilePath: defaultQualityReportFilePath(this.opts.newmanReportFilePath),
      enableBlobUploader: false,
      blobConnectionString: "",
      testDefFilePath: "",
      runId: uuid.v4(),
    });
    const swaggerFileAbsolutePaths = this.opts.swaggerFilePaths!.map((it) => path.resolve(it));
    this.exampleQualityValidator = ExampleQualityValidator.create({
      swaggerFilePaths: [...swaggerFileAbsolutePaths],
    });
    this.recording = new Map<string, RawExecution>();
    this.operationIds = new Set<string>();
    this.fileRoot = findNearestReadmeDir(this.opts.testDefFilePath) || "/";

    this.swaggerExampleQualityResult = {
      testScenario: {
        testScenarioFilePath: path.relative(this.fileRoot, this.opts.testDefFilePath),
        swaggerFilePaths: this.opts.swaggerFilePaths!.map((it) => path.relative(this.fileRoot, it)),
        resourceProvider: getProviderFromFilePath(this.opts.testDefFilePath),
        apiVersion: getApiVersionFromSwaggerFile(this.opts.swaggerFilePaths![0]),
        runId: this.opts.runId,
        fileRoot: this.fileRoot,
        repository: process.env.SPEC_REPOSITORY,
        branch: process.env.SPEC_BRANCH,
        commitHash: process.env.COMMIT_HASH,
      },
      stepResult: {},
    };
    this.testDefFile = undefined;
  }

  public async initialize() {
    this.rawReport = await this.postmanReportParser.generateRawReport();
  }

  public async generateExampleQualityReport(rawReport: RawReport) {
    await this.initialize();
    const variables = rawReport.variables;
    this.swaggerExampleQualityResult.testScenario.startTime = rawReport.timings.started;
    this.swaggerExampleQualityResult.testScenario.endTime = rawReport.timings.completed;
    this.swaggerExampleQualityResult.testScenario.subscriptionId = variables.subscriptionId;
    for (const it of rawReport.executions) {
      if (it.annotation === undefined) {
        continue;
      }
      if (it.annotation.type === "simple" || it.annotation.type === "LRO") {
        let error: any = {};
        const generatedExample = this.generateExample(it, variables, rawReport);
        const matchedStep = this.getMatchedStep(it.annotation.step) as TestStepRestCall;
        if (
          Math.floor(it.response.statusCode / 200) !== 1 &&
          it.response.statusCode !== matchedStep.statusCode
        ) {
          error = { statusCode: it.response.statusCode, rawExecution: it } as HttpError;
        }
        if (matchedStep === undefined) {
          continue;
        }
        // validate real payload.
        const roundtripErrors = await this.exampleQualityValidator.validateExternalExamples([
          {
            exampleFilePath: generatedExample.exampleFilePath,
            example: generatedExample.example,
            operationId: matchedStep.operationId,
          },
        ]);
        const correlationId = it.response.headers["x-ms-correlation-request-id"];
        this.swaggerExampleQualityResult.stepResult[it.annotation.step] = {
          exampleFilePath: generatedExample.exampleFilePath,
          operationId: it.annotation.operationId,
          runtimeError: error,
          responseDiffResult: this.exampleResponseDiff(generatedExample, matchedStep),
          stepValidationResult: roundtripErrors,
          correlationId: correlationId,
        };
        this.recording.set(correlationId, it);
      }
    }
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

        for (const [correlationId, v] of this.recording) {
          const payloadBlobPath = `${path.dirname(blobPath)}/${correlationId}.json`;
          await this.blobUploader.uploadContent(
            "payload",
            payloadBlobPath,
            JSON.stringify(v, null, 2)
          );
        }
      }
    }
    console.log(JSON.stringify(this.swaggerExampleQualityResult, null, 2));
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

  private exampleResponseDiff(
    example: GeneratedExample,
    matchedStep: TestStep
  ): { [statusCode: number]: JsonPatchOp[] } {
    const res: any = {};
    if (matchedStep?.type === "restCall") {
      if (example.example.responses[matchedStep.statusCode] !== undefined) {
        res[matchedStep.statusCode] = this.responseDiff(
          example.example.responses[matchedStep.statusCode]?.body || {},
          matchedStep.responseExpected,
          this.rawReport!.variables
        );
      }
    }
    return res;
  }

  private responseDiff(resp: any, expectedResp: any, variables: any) {
    const env = new VariableEnv();
    env.setBatch(variables);
    try {
      const expected = env.resolveObjectValues(expectedResp);
      const delta = getJsonPatchDiff(expected, resp, {
        includeOldValue: true,
        minimizeDiff: false,
      }).map((it: any) => {
        const ret: any = {};
        if (it.remove !== undefined) {
          ret.code = "RESPONSE_ADDITIONAL_VALUE";
          ret.severity = Severity.Error;
        } else if (it.add !== undefined) {
          ret.code = "RESPONSE_MISSING_VALUE";
          ret.severity = Severity.Error;
        } else {
          ret.code = "RESPONSE_INCORRECT_VALUE";
          ret.severity = Severity.Error;
        }
        ret.detail = it;
        return ret;
      });
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

  public async generateReport() {
    this.testDefFile = await this.testResourceLoader.load(this.opts.testDefFilePath);
    await this.initialize();
    await this.generateExampleQualityReport(this.rawReport!);
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
