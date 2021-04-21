import * as path from "path";
import * as _ from "lodash";
import { injectable, inject } from "inversify";
import { ExampleQualityValidator } from "../exampleQualityValidator/exampleQualityValidator";
import { setDefaultOpts } from "../swagger/loader";
import { getProviderFromFilePath } from "../util/utils";
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
import { BlobUploader, TestScenarioBlobUploaderOption } from "./blobUploader";

interface GeneratedExample {
  exampleName: string;
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
  };
  stepResult: { [step: string]: StepResult };
}

interface StepResult {
  exampleName?: string;
  example?: SwaggerExample;
  operationId: string;
  runtimeError?: HttpError;
  responseDiffResult?: { [statusCode: number]: JsonPatchOp[] };
  liveValidationResult?: any;
  stepValidationResult?: any;
}

interface HttpError {
  statusCode: number;
  rawExecution: RawExecution;
}

export interface ReportGeneratorOption
  extends NewmanReportParserOption,
    TestResourceLoaderOption,
    TestScenarioBlobUploaderOption {
  testDefFilePath: string;
  reportOutputFilePath?: string;
}

@injectable()
export class ReportGenerator {
  private exampleQualityValidator: ExampleQualityValidator;
  private swaggerExampleQualityResult: TestScenarioResult;
  private testDefFile: TestDefinitionFile | undefined;
  private operationIds: Set<string>;
  private rawReport: RawReport | undefined;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: ReportGeneratorOption,
    private postmanReportParser: NewmanReportParser,
    private testResourceLoader: TestResourceLoader,
    private fileLoader: FileLoader,
    private blobUploader: BlobUploader
  ) {
    setDefaultOpts(this.opts, {
      newmanReportFilePath: "",
      reportOutputFilePath: defaultQualityReportFilePath(this.opts.newmanReportFilePath),
      enableBlobUploader: false,
      blobConnectionString: "",
      testDefFilePath: "",
    });
    const swaggerFileAbsolutePaths = this.opts.swaggerFilePaths!.map((it) => path.resolve(it));
    this.exampleQualityValidator = ExampleQualityValidator.create({
      swaggerFilePaths: [...swaggerFileAbsolutePaths],
    });
    this.operationIds = new Set<string>();
    this.swaggerExampleQualityResult = {
      testScenario: {
        testScenarioFilePath: this.opts.testDefFilePath,
        swaggerFilePaths: this.opts.swaggerFilePaths!,
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
            exampleFilePath: generatedExample.exampleName,
            example: generatedExample.example,
            operationId: matchedStep.operationId,
          },
        ]);
        this.swaggerExampleQualityResult.stepResult[it.annotation.step] = {
          exampleName: generatedExample.exampleName,
          operationId: it.annotation.operationId,
          runtimeError: error,
          responseDiffResult: this.exampleResponseDiff(generatedExample, matchedStep),
          stepValidationResult: roundtripErrors,
        };
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
        //blobPath should follow <ResourceProvider>/<api-version>/<test-scenario-file-name>.json pattern
        await this.blobUploader.uploadFile("report", blobPath, this.opts.reportOutputFilePath);
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
    const exampleName = it.annotation.exampleName.replace(/^.*[\\\/]/, "");
    const generatedGetExecution = this.findGeneratedGetExecution(it, rawReport);
    if (generatedGetExecution.length > 0) {
      const getResp = this.parseRespBody(generatedGetExecution[0]);
      _.extend(example.responses, getResp);
    }
    return {
      exampleName,
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
