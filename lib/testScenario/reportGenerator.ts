import { ExampleQualityValidator } from './../validators/qualityValidator';
import * as fs from "fs";
import * as path from "path";
import * as _ from "lodash";
import { LiveValidator } from "../liveValidation/liveValidator";
import { TestResourceLoader } from "./testResourceLoader";
import { PostmanReportParser } from "./postmanReportParser";
import { exampleDiff } from "./exampleDiff";
import { RawReport, RawExecution, TestDefinitionFile } from "./testResourceTypes";

export class ReportGenerator {
  private pollingMap: Map<string, any>;
  private liveValidator: LiveValidator;
  private postmanReportParser: PostmanReportParser;
  private testResourceLoader: TestResourceLoader;
  private validationResult: any;
  private diffResult: any;
  private swaggerExampleQualityResult: any;
  private generatedExamples: any;
  private httpRecordingPath: string;
  private testDefFile: TestDefinitionFile | undefined;
  private exampleFileMapping: any;
  private operationIds: Set<string>
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
    this.pollingMap = new Map<string, any>();
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
    this.generatedExamples = new Map<string, any>();
    this.httpRecordingPath = path.resolve(this.output, "recording.json");
    this.testDefFile = undefined;
    this.postmanReportParser = new PostmanReportParser(
      this.newmanReportPath,
      this.httpRecordingPath
    );
  }

  public async generateReport() {
    this.ensureGeneratedFolder();
    this.copySourceFile();
    this.postmanReportParser.generateRawReport();
    await this.liveValidator.initialize();
    this.testDefFile = await this.testResourceLoader.load(this.testDefFilePath);

    const rawReport: RawReport = JSON.parse(fs.readFileSync(this.httpRecordingPath).toString());
    const variables = rawReport.variables;
    for (const it of rawReport.executions) {
      if (it.annotation === undefined) {
        continue;
      }
      await this.generateExample(it, variables);
    }

    this.generateDiff(variables);
    this.writeGeneratedExamples();
    await this.exampleQuality();
    this.outputResult();
  }

  private async exampleQuality() {
    const operationIds = Array.from(this.operationIds)
    for(const it of this.swaggerFilePaths){
      const swaggerFileName = it.replace(/^.*[\\\/]/, "")
      const validator = ExampleQualityValidator.create({swaggerFilePath:  path.resolve(this.output, it.replace(/^.*[\\\/]/, ""))})
      const result = await validator.validateSwaggerExamples(operationIds)
      this.swaggerExampleQualityResult[swaggerFileName] = result
    }
  }

  private async generateExample(it: RawExecution, variables: any) {
    if (it.annotation.type === "simple" || it.annotation.type === "LRO") {
      const example: any = {};
      if(it.annotation.operationId!==undefined){
        this.operationIds.add(it.annotation.operationId)
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
      this.generatedExamples.set(
        it.annotation.poller_item_name.replace("_poller", "") || exampleName,
        {
          exampleName: exampleName,
          operationId: it.annotation.operationId,
          example: example,
        }
      );
      await this.liveValidate(it, exampleName);
    } else if (it.annotation.type === "poller") {
      const resp: any = this.parseRespBody(it);
      this.pollingMap.set(it.annotation.lro_item_name, resp);
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
    fs.writeFileSync(`${this.output}/exampleQuality.json`, JSON.stringify(this.swaggerExampleQualityResult, null, 2))

    fs.writeFileSync(
      `${this.output}/exampleFileMapping.json`,
      JSON.stringify(this.exampleFileMapping, null, 2)
    )

    fs.writeFileSync(
      `${this.output}/liveValidation.json`,
      JSON.stringify(this.validationResult, null, 2)
    );

    fs.writeFileSync(`${this.output}/diff.json`, JSON.stringify(this.diffResult, null, 2));
  }

  private writeGeneratedExamples () {
    for ( const v of this.generatedExamples.values() ) {
      const exampleFilePath = path.resolve( `${this.output}/examples/${v.exampleName}` );
      fs.writeFileSync(
        exampleFilePath,
        JSON.stringify( v.example, null, 2 )
      );
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
      if (step.type === "exampleFile") {
        if (step.exampleFilePath.includes(exampleName)) {
          return path.resolve(this.swaggerRootPath, step.exampleFilePath);
        }
      }
    }

    for (const testScenario of this.testDefFile!.testScenarios) {
      for (const step of testScenario.steps) {
        if (step.type === "exampleFile") {
          if (step.exampleFilePath.includes(exampleName)) {
            return path.resolve(this.swaggerRootPath, step.exampleFilePath);
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
