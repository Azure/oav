import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";
import { ExampleQualityValidator } from "../exampleQualityValidator/exampleQualityValidator";
import { LiveValidator } from "../liveValidation/liveValidator";
import { SwaggerExample } from "./../swagger/swaggerTypes";
import { TestResourceLoader } from "./testResourceLoader";
import { PostmanReportParser } from "./postmanReportParser";
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
import { result } from "lodash";

const safeJsonParse = (content: string) => {
  try {
    return JSON.parse(content);
  } catch (err) {
    return {};
  }
};

const getSwaggerRootPath = (swaggerRootPath: string) => {
  const idx = swaggerRootPath.lastIndexOf("specification");
  return swaggerRootPath.substring(0, idx);
};

type GeneratedExample = {
  exampleName: string;
  step: string;
  operationId: string;
  example: SwaggerExample;
};

type TestScenarioResult = {
  testScenario: {
    testScenarioFilePath: string;
    readmeFilePath: string;
    swaggerFilePaths: string[];
    tag: string;
  };
  stepResult: { [step: string]: StepResult };
};

type StepResult = {
  exampleName?: string;
  example?: SwaggerExample;
  operationId: string;
  runtimeError?: HttpError;
  responseDiffResult?: { [statusCode: number]: JsonPatchOp[] };
  liveValidationResult?: any;
  stepValidationResult?: any;
};

type HttpError = {
  statusCode: number;
  rawExecution: RawExecution;
};

type RunnerResultContext = {
  exampleFile?: string;
  testScenario: {
    swaggerFilePaths: [];
    tag: string;
    testScenarioFilePath: string;
    readmeFilePath: string;
  };
};

export class ReportGenerator {
  private liveValidator: LiveValidator;
  private exampleQualityValidator: ExampleQualityValidator;
  private postmanReportParser: PostmanReportParser;
  private testResourceLoader: TestResourceLoader;
  private validationResult: any;
  private diffResult: any;
  private swaggerExampleQualityResult: TestScenarioResult;
  private generatedExamplesMapping: Map<string, GeneratedExample>;
  private httpRecordingPath: string;
  private testDefFile: TestDefinitionFile | undefined;
  private exampleFileMapping: Array<{ exampleFilePath: string; operationId: string }>;
  private operationIds: Set<string>;
  private rawReport: RawReport;
  private testScenarioInfo: any;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    private newmanReportPath: string,
    private output: string,
    private swaggerRootPath: string,
    private swaggerFilePaths: string[],
    private testDefFilePath: string,
    private readmePath: string,
    private tag: string
  ) {
    this.testResourceLoader = TestResourceLoader.create({
      useJsonParser: false,
      checkUnderFileRoot: false,
      fileRoot: this.swaggerRootPath,
      swaggerFilePaths: this.swaggerFilePaths,
    });
    const swaggerFileAbsolutePaths = this.swaggerFilePaths.map((it) =>
      path.resolve(this.swaggerRootPath, it)
    );
    this.liveValidator = new LiveValidator({
      swaggerPaths: swaggerFileAbsolutePaths,
      directory: getSwaggerRootPath(this.swaggerRootPath),
      loadValidatorInInitialize: true,
      loadValidatorInBackground: false,
    });
    this.exampleQualityValidator = ExampleQualityValidator.create({
      swaggerFilePaths: [...swaggerFileAbsolutePaths],
    });
    this.exampleFileMapping = [];
    this.operationIds = new Set<string>();
    this.validationResult = {};
    this.testScenarioInfo = {
      testScenarioFilePath: this.testDefFilePath,
      readmeFilePath: this.readmePath,
      swaggerFilePaths: swaggerFilePaths,
      tag: this.tag,
    };
    this.swaggerExampleQualityResult = {
      testScenario: {
        testScenarioFilePath: this.testDefFilePath,
        readmeFilePath: this.readmePath,
        swaggerFilePaths: swaggerFilePaths,
        tag: this.tag,
      },
      stepResult: {},
    };
    this.diffResult = {};
    this.generatedExamplesMapping = new Map<string, GeneratedExample>();
    this.httpRecordingPath = path.resolve(this.output, "recording.json");
    this.testDefFile = undefined;
    this.postmanReportParser = new PostmanReportParser(
      this.newmanReportPath,
      this.httpRecordingPath
    );
    this.rawReport = this.postmanReportParser.generateRawReport();
  }

  private applyContextToResult(context: any, results: any[]) {
    return results.map((it) => _.extend(context, it));
  }

  public async generateExampleQualityReport(rawReport: RawReport) {
    const variables = rawReport.variables;
    let res: any[] = [];
    for (const it of rawReport.executions) {
      if (it.annotation === undefined) {
        continue;
      }
      if (it.annotation.type === "simple" || it.annotation.type === "LRO") {
        let error: any = {};
        const generatedExample = this.generateExample(it, variables, rawReport);
        this.generatedExamplesMapping.set(generatedExample.exampleName, generatedExample);
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
        // res = res.concat(this.applyContextToResult(_.extend(), roundtripErrors));
        this.swaggerExampleQualityResult.stepResult[it.annotation.step] = {
          exampleName: generatedExample.exampleName,
          operationId: it.annotation.operationId,
          runtimeError: error,
          responseDiffResult: this.exampleResponseDiff(generatedExample, matchedStep),
          stepValidationResult: roundtripErrors,
          liveValidationResult: await this.liveValidate(it, generatedExample.exampleName),
        };
      }
    }
    this.writeGeneratedExamples();
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
      res[matchedStep.statusCode] = this.responseDiff(
        example.example.responses[matchedStep.statusCode] || {},
        matchedStep.responseExpected,
        this.rawReport.variables
      );
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
    this.testDefFile = await this.testResourceLoader.load(this.testDefFilePath);
    await this.liveValidator.initialize();
    this.ensureGeneratedFolder();
    this.copySourceFile();
    await this.generateExampleQualityReport(this.rawReport);
    this.outputResult();
  }

  private copySourceFile() {
    fs.copyFileSync(
      path.resolve(this.swaggerRootPath, this.testDefFilePath),
      path.resolve(this.output, "test-scenarios", this.testDefFilePath.replace(/^.*[\\\/]/, ""))
    );
    fs.copyFileSync(
      this.readmePath,
      path.resolve(this.output, this.readmePath.replace(/^.*[\\\/]/, ""))
    );

    for (const it of this.swaggerFilePaths) {
      fs.copyFileSync(
        path.resolve(this.swaggerRootPath, it),
        path.resolve(this.output, it.replace(/^.*[\\\/]/, ""))
      );
    }
  }

  private outputResult() {
    fs.writeFileSync(
      `${this.output}/testScenarioRunnerReport.json`,
      JSON.stringify(this.swaggerExampleQualityResult, null, 2)
    );

    fs.writeFileSync(
      `${this.output}/exampleFileMapping.json`,
      JSON.stringify(this.exampleFileMapping, null, 2)
    );

    fs.writeFileSync(
      `${this.output}/liveValidation.json`,
      JSON.stringify(this.validationResult, null, 2)
    );

    fs.writeFileSync(`${this.output}/diff.json`, JSON.stringify(this.diffResult, null, 2));
  }

  private writeGeneratedExamples() {
    for (const v of this.generatedExamplesMapping.values()) {
      const exampleFilePath = path.resolve(`${this.output}/examples/${v.exampleName}`);
      fs.writeFileSync(exampleFilePath, JSON.stringify(v.example, null, 2));
      this.exampleFileMapping.push({
        exampleFilePath: exampleFilePath,
        operationId: v.operationId,
      });
    }
  }

  private async liveValidate(it: RawExecution, exampleName: any): Promise<any> {
    const validationRes = await this.liveValidator.validateLiveRequestResponse({
      liveRequest: {
        url: it.request.url,
        method: it.request.method,
        headers: this.getValueStringifiedMap(it.request.headers),
        body: safeJsonParse(it.request.body),
      },
      liveResponse: {
        statusCode: it.response.statusCode.toString(),
        headers: this.getValueStringifiedMap(it.response.headers),
        body: safeJsonParse(it.response.body),
      },
    });
    this.validationResult[exampleName] = validationRes;
    return validationRes;
  }

  private ensureGeneratedFolder() {
    if (!fs.existsSync(this.output)) {
      fs.mkdirSync(this.output);
    }
    if (!fs.existsSync(path.resolve(this.output, "examples"))) {
      fs.mkdirSync(path.resolve(this.output, "examples"));
    }
    if (!fs.existsSync(path.resolve(this.output, "test-scenarios"))) {
      fs.mkdirSync(path.resolve(this.output, "test-scenarios"));
    }
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

  private getValueStringifiedMap(header: any) {
    const res = _.cloneDeep(header);
    for (const k of Object.keys(res)) {
      res[k] = res[k].toString();
    }
    return res;
  }
}
