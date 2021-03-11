import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";
import { LiveValidator } from "../liveValidation/liveValidator";
import { SwaggerExample } from "./../swagger/swaggerTypes";
import { ExampleQualityValidator } from "./../validators/qualityValidator";
import { TestResourceLoader } from "./testResourceLoader";
import { PostmanReportParser } from "./postmanReportParser";
import { exampleDiff } from "./exampleDiff";
import { RawReport, RawExecution, TestDefinitionFile, TestStep } from "./testResourceTypes";

type GeneratedExample = {
  exampleName: string;
  step: string;
  operationId: string;
  example: SwaggerExample;
};
export class ReportGenerator {
  private liveValidator: LiveValidator;
  private postmanReportParser: PostmanReportParser;
  private testResourceLoader: TestResourceLoader;
  private validationResult: any;
  private diffResult: any;
  private swaggerExampleQualityResult: any;
  private generatedExamples: Map<string, GeneratedExample>;
  private httpRecordingPath: string;
  private testDefFile: TestDefinitionFile | undefined;
  private exampleFileMapping: any;
  private operationIds: Set<string>;
  private rawReport: RawReport;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    private newmanReportPath: string,
    private output: string,
    private swaggerRootPath: string,
    private swaggerFilePaths: string[],
    private testDefFilePath: string,
    private readmePath: string
  ) {
    this.testResourceLoader = TestResourceLoader.create({
      useJsonParser: false,
      checkUnderFileRoot: false,
      fileRoot: this.swaggerRootPath,
      swaggerFilePaths: this.swaggerFilePaths,
    });
    this.liveValidator = new LiveValidator({
      swaggerPaths: this.swaggerFilePaths.map((it) => path.resolve(this.swaggerRootPath, it)),
      directory: this.swaggerRootPath,
      loadValidatorInInitialize: true,
      loadValidatorInBackground: false,
    });
    this.exampleFileMapping = {};
    this.operationIds = new Set<string>();
    this.validationResult = {};
    this.swaggerExampleQualityResult = {};
    this.diffResult = {};
    this.generatedExamples = new Map<string, GeneratedExample>();
    this.httpRecordingPath = path.resolve(this.output, "recording.json");
    this.testDefFile = undefined;
    this.postmanReportParser = new PostmanReportParser(
      this.newmanReportPath,
      this.httpRecordingPath
    );
    this.rawReport = this.postmanReportParser.generateRawReport();
  }

  public async generateExamples() {
    await this.generateExampleFromRawReport(this.rawReport);
  }

  public async generateExampleFromRawReport(rawReport: RawReport) {
    const variables = rawReport.variables;
    for (const it of rawReport.executions) {
      if (it.annotation === undefined) {
        continue;
      }
      if (it.annotation.type === "simple" || it.annotation.type === "LRO") {
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
        this.generatedExamples.set(exampleName, {
          exampleName: exampleName,
          step: it.annotation.step,
          operationId: it.annotation.operationId,
          example: example,
        });
      }
    }
    this.writeGeneratedExamples();
  }

  private validateExample() {
    for (const example of this.generatedExamples.values()) {
      const matchedStep = this.getMatchedStep(example.step);
      if (matchedStep?.type === "restCall") {
        // do example diff
        console.log(matchedStep.responseExpected);
      }
    }
  }

  private responseDiff(resp: any, expectedResp: any) {}

  private getMatchedStep(stepName: string): TestStep | undefined {
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
    this.ensureGeneratedFolder();
    this.copySourceFile();
    await this.liveValidator.initialize();
    await this.generateExamples();
    this.validateExample();
    await this.exampleQuality();
    this.outputResult();
  }

  private async exampleQuality() {
    const operationIds = Array.from(this.operationIds);
    for (const it of this.swaggerFilePaths) {
      const swaggerFileName = it.replace(/^.*[\\\/]/, "");
      const validator = ExampleQualityValidator.create({
        swaggerFilePath: path.resolve(this.output, it.replace(/^.*[\\\/]/, "")),
      });
      const result = await validator.validateSwaggerExamples(operationIds);
      this.swaggerExampleQualityResult[swaggerFileName] = result;
    }
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
      `${this.output}/exampleQuality.json`,
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
    for (const v of this.generatedExamples.values()) {
      const exampleFilePath = path.resolve(`${this.output}/examples/${v.exampleName}`);
      fs.writeFileSync(exampleFilePath, JSON.stringify(v.example, null, 2));
      this.exampleFileMapping[exampleFilePath] = v.operationId;
    }
  }

  private async liveValidate(it: RawExecution, exampleName: any) {
    const validationRes = await this.liveValidator.validateLiveRequestResponse({
      liveRequest: {
        url: it.request.url,
        method: it.request.method,
        headers: this.getValueStringifiedMap(it.request.headers),
        body: JSON.parse(it.request.body),
      },
      liveResponse: {
        statusCode: it.response.statusCode,
        headers: this.getValueStringifiedMap(it.response.headers),
        body: JSON.parse(it.request.body),
      },
    });
    this.validationResult[exampleName] = validationRes;
  }

  private generateDiff(variables: any) {
    for (const v of this.generatedExamples.values()) {
      const oldExamplePath = this.findOldExampleFilePath(v.exampleName);
      if (oldExamplePath === undefined) {
        continue;
      }
      const oldExample = JSON.parse(fs.readFileSync(oldExamplePath).toString());
      //TODO: get all readonly field and mask it as ignored.
      const delta = exampleDiff(oldExample, v.example, {
        suppressionVariables: Object.keys(variables).concat(Object.values(variables)),
        suppressionPath: [],
        ignoreRemovedResponse: true,
        ignoreReplaceInResponse: false,
      });
      this.diffResult[v.exampleName] = delta;
    }
  }

  private findOldExampleFilePath(exampleName: string) {
    for (const step of this.testDefFile!.prepareSteps) {
      if (step.type === "restCall") {
        if (step.exampleFile?.includes(exampleName)) {
          return path.resolve(this.swaggerRootPath, step.exampleFilePath!);
        }
      }
    }

    for (const testScenario of this.testDefFile!.testScenarios) {
      for (const step of testScenario.steps) {
        if (step.type === "restCall") {
          if (step.exampleFilePath?.includes(exampleName)) {
            return path.resolve(this.swaggerRootPath, step.exampleFilePath!);
          }
        }
      }
    }
    return undefined;
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
