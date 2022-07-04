import * as path from "path";
import { findReadMe } from "@azure/openapi-markdown";
import { inject, injectable } from "inversify";
import * as uuid from "uuid";
import { PayloadCache } from "../generator/exampleCache";
import Translator from "../generator/translator";
import { TYPES } from "../inversifyUtils";
import {
  LiveValidator,
  RequestResponseLiveValidationResult,
  RequestResponsePair,
} from "../liveValidation/liveValidator";
import { LiveRequest, LiveResponse } from "../liveValidation/operationValidator";
import { ReportGenerator as HtmlReportGenerator } from "../report/generateReport";
import { FileLoader } from "../swagger/fileLoader";
import { JsonLoader } from "../swagger/jsonLoader";
import { setDefaultOpts } from "../swagger/loader";
import { SwaggerExample } from "../swagger/swaggerTypes";
import {
  OperationCoverageInfo,
  TrafficValidationIssue,
  TrafficValidationOptions,
  unCoveredOperationsFormat,
} from "../swaggerValidator/trafficValidator";
import { SeverityString } from "../util/severity";
import { getApiVersionFromSwaggerPath, getProviderFromFilePath } from "../util/utils";
import { ApiScenarioLoader, ApiScenarioLoaderOption } from "./apiScenarioLoader";
import {
  RawExecution,
  RawReport,
  ScenarioDefinition,
  Step,
  StepRestCall,
} from "./apiScenarioTypes";
import { DataMasker } from "./dataMasker";
import { defaultQualityReportFilePath } from "./defaultNaming";
import { getJsonPatchDiff } from "./diffUtils";
import { JUnitReporter } from "./junitReport";
import { generateMarkdownReport } from "./markdownReport";
import { NewmanReportParser, NewmanReportParserOption } from "./postmanReportParser";
import { SwaggerAnalyzer } from "./swaggerAnalyzer";
import { VariableEnv } from "./variableEnv";

interface GeneratedExample {
  step: string;
  operationId: string;
  example: SwaggerExample;
}

export interface ApiScenarioTestResult {
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
  liveValidationResult?: RequestResponseLiveValidationResult;
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

export type ValidationLevel = "validate-request" | "validate-request-response";

export interface ReportGeneratorOption extends NewmanReportParserOption, ApiScenarioLoaderOption {
  apiScenarioFilePath: string;
  reportOutputFilePath?: string;
  markdownReportPath?: string;
  junitReportPath?: string;
  htmlReportPath?: string;
  apiScenarioName?: string;
  runId?: string;
  validationLevel?: ValidationLevel;
  savePayload?: boolean;
  generateExample?: boolean;
  verbose?: boolean;
  swaggerFilePaths?: string[];
}

@injectable()
export class ReportGenerator {
  private swaggerExampleQualityResult: ApiScenarioTestResult;
  private testDefFile: ScenarioDefinition | undefined;
  private rawReport: RawReport | undefined;
  private fileRoot: string;
  private liveValidator: LiveValidator;
  private trafficValidationResult: TrafficValidationIssue[];
  private payloadCache: PayloadCache;
  private translator: Translator;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: ReportGeneratorOption,
    private postmanReportParser: NewmanReportParser,
    private testResourceLoader: ApiScenarioLoader,
    private fileLoader: FileLoader,
    private jsonLoader: JsonLoader,
    private dataMasker: DataMasker,
    private swaggerAnalyzer: SwaggerAnalyzer,
    private junitReporter: JUnitReporter
  ) {
    setDefaultOpts(this.opts, {
      newmanReportFilePath: "",
      reportOutputFilePath: defaultQualityReportFilePath(this.opts.newmanReportFilePath),
      apiScenarioFilePath: "",
      runId: uuid.v4(),
      validationLevel: "validate-request-response",
      savePayload: false,
      generateExample: false,
      verbose: false,
    });
    this.payloadCache = new PayloadCache();
    this.translator = new Translator(this.jsonLoader, this.payloadCache);
  }

  public async initialize() {
    this.fileRoot = (await findReadMe(this.opts.apiScenarioFilePath)) || "/";

    this.swaggerExampleQualityResult = {
      testScenarioFilePath: path.relative(this.fileRoot, this.opts.apiScenarioFilePath),
      swaggerFilePaths: this.opts.swaggerFilePaths!,
      providerNamespace: getProviderFromFilePath(this.opts.apiScenarioFilePath),
      apiVersion: getApiVersionFromSwaggerPath(
        this.fileLoader.resolvePath(this.opts.swaggerFilePaths![0])
      ),
      runId: this.opts.runId,
      rootPath: this.fileRoot,
      repository: process.env.SPEC_REPOSITORY,
      branch: process.env.SPEC_BRANCH,
      commitHash: process.env.COMMIT_HASH,
      environment: process.env.ENVIRONMENT || "test",
      testScenarioName: this.opts.apiScenarioName,
      armEndpoint: "https://management.azure.com",
      stepResult: [],
    };
    // this.testDefFile = undefined;

    this.liveValidator = new LiveValidator({
      fileRoot: "/",
      swaggerPaths: this.opts.swaggerFilePaths!,
    });

    this.rawReport = await this.postmanReportParser.generateRawReport(
      this.opts.newmanReportFilePath
    );
  }

  public async generateApiScenarioTestResult(rawReport: RawReport) {
    await this.initialize();
    await this.liveValidator.initialize();
    this.trafficValidationResult = [];
    const variables = rawReport.variables;
    this.swaggerExampleQualityResult.startTime = new Date(rawReport.timings.started).toISOString();
    this.swaggerExampleQualityResult.endTime = new Date(rawReport.timings.completed).toISOString();
    this.swaggerExampleQualityResult.subscriptionId = variables.subscriptionId.value as string;
    for (const it of rawReport.executions) {
      if (it.annotation === undefined) {
        continue;
      }
      if (it.annotation.type === "simple" || it.annotation.type === "LRO") {
        const runtimeError: RuntimeError[] = [];
        const matchedStep = this.getMatchedStep(it.annotation.step) as StepRestCall;

        const trafficValidationIssue: TrafficValidationIssue = {
          runtimeExceptions: [],
          errors: [],
        };
        // Runtime errors
        if (it.response.statusCode >= 400) {
          const error = this.getRuntimeError(it);
          runtimeError.push(error);
          trafficValidationIssue.runtimeExceptions?.push(error);
        }
        if (matchedStep === undefined) {
          continue;
        }
        trafficValidationIssue.operationInfo = {
          operationId: matchedStep.operationId,
          apiVersion: "",
        };
        trafficValidationIssue.specFilePath = matchedStep.operation._path._spec._filePath;

        const payload = this.convertToLiveValidationPayload(it);

        let responseDiffResult: ResponseDiffItem[] | undefined = undefined;
        const statusCode = `${it.response.statusCode}`;
        const exampleFilePath = `examples/${matchedStep.step}_${statusCode}.json`;
        if (this.opts.generateExample || it.annotation.exampleName) {
          const generatedExample = {
            parameters: this.translator.extractRequest(matchedStep.operation, payload.liveRequest),
            responses: {
              [statusCode]: this.translator.extractResponse(
                matchedStep.operation,
                payload.liveResponse,
                statusCode
              ),
            },
          };

          // Example validation
          if (this.opts.generateExample) {
            await this.fileLoader.writeFile(
              path.resolve(path.dirname(this.opts.newmanReportFilePath), exampleFilePath),
              JSON.stringify(generatedExample, null, 2)
            );
          }
          if (it.annotation.exampleName) {
            // validate real payload.
            responseDiffResult =
              this.opts.validationLevel === "validate-request-response"
                ? await this.exampleResponseDiff(
                    {
                      step: matchedStep.step,
                      operationId: matchedStep.operationId,
                      example: generatedExample,
                    },
                    matchedStep
                  )
                : [];
          }
        }

        // Schema validation
        const correlationId = it.response.headers["x-ms-correlation-request-id"];
        if (this.opts.savePayload) {
          const payloadFilePath = `payloads/${matchedStep.step}_${correlationId}.json`;
          await this.fileLoader.writeFile(
            path.resolve(path.dirname(this.opts.newmanReportFilePath), payloadFilePath),
            JSON.stringify(payload, null, 2)
          );
          trafficValidationIssue.payloadFilePath = payloadFilePath;
        }
        const liveValidationResult = await this.liveValidator.validateLiveRequestResponse(payload);

        trafficValidationIssue.errors?.push(
          ...liveValidationResult.requestValidationResult.errors,
          ...liveValidationResult.responseValidationResult.errors
        );
        if (liveValidationResult.requestValidationResult.runtimeException) {
          trafficValidationIssue.runtimeExceptions?.push(
            liveValidationResult.requestValidationResult.runtimeException
          );
        }

        if (liveValidationResult.responseValidationResult.runtimeException) {
          trafficValidationIssue.runtimeExceptions?.push(
            liveValidationResult.responseValidationResult.runtimeException
          );
        }

        this.trafficValidationResult.push(trafficValidationIssue);

        this.swaggerExampleQualityResult.stepResult.push({
          exampleFilePath: exampleFilePath,
          operationId: it.annotation.operationId,
          runtimeError,
          responseDiffResult: responseDiffResult,
          correlationId: correlationId,
          statusCode: it.response.statusCode,
          stepName: it.annotation.step,
          liveValidationResult: liveValidationResult,
        });
      }
    }
  }

  private convertToLiveValidationPayload(rawExecution: RawExecution): RequestResponsePair {
    const request = rawExecution.request;
    const response = rawExecution.response;
    const liveRequest: LiveRequest = {
      url: request.url.toString(),
      method: request.method.toLowerCase(),
      headers: request.headers,
      body: request.body ? JSON.parse(request.body) : undefined,
    };
    const liveResponse: LiveResponse = {
      statusCode: response.statusCode.toString(),
      headers: response.headers,
      body: response.body ? JSON.parse(response.body) : undefined,
    };
    return {
      liveRequest,
      liveResponse,
    };
  }

  private convertPostmanFormat<T>(obj: T, convertString: (s: string) => string): T {
    if (typeof obj === "string") {
      return convertString(obj) as unknown as T;
    }
    if (typeof obj !== "object") {
      return obj;
    }
    if (obj === null || obj === undefined) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return (obj as any[]).map((v) => this.convertPostmanFormat(v, convertString)) as unknown as T;
    }

    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = this.convertPostmanFormat((obj as any)[key], convertString);
    }
    return result;
  }

  private async exampleResponseDiff(
    example: GeneratedExample,
    matchedStep: Step
  ): Promise<ResponseDiffItem[]> {
    let res: ResponseDiffItem[] = [];
    if (matchedStep?.type === "restCall") {
      if (example.example.responses["200"] !== undefined) {
        Object.keys(matchedStep.variables).forEach((key) => {
          const paramName = `${matchedStep.step}_${key}`;
          matchedStep.responses = this.convertPostmanFormat(matchedStep.responses, (s) =>
            s.replace(`$(${key})`, `$(${paramName})`)
          );
        });
        res = res.concat(
          await this.responseDiff(
            example.example.responses["200"]?.body || {},
            matchedStep.responses["200"]?.body || {},
            this.rawReport!.variables,
            `/200/body`,
            matchedStep.operation.responses["200"].schema
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
    const env = new VariableEnv(variables);
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

            const paths = it.replace.split("/");
            while (paths.length > 1) {
              const path = paths.join("/");
              const sch = this.swaggerAnalyzer.findSchemaByJsonPointer(path, schema, resp);
              // Ignore diff when propertySchema readonly is true. When property is readonly, it's probably a random generated value which updated dynamically per request.
              if (sch.readOnly === true) {
                return undefined;
              }
              paths.pop();
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
      // eslint-disable-next-line no-empty
    } catch (err) {}
    return [];
  }

  private getMatchedStep(stepName: string): Step | undefined {
    for (const it of this.testDefFile?.prepareSteps ?? []) {
      if (stepName === it.step) {
        return it;
      }
    }
    for (const testScenario of this.testDefFile?.scenarios ?? []) {
      for (const step of testScenario.steps) {
        if (stepName === step.step) {
          return step;
        }
      }
    }
    return undefined;
  }

  private getRuntimeError(it: RawExecution): RuntimeError {
    const responseObj = this.dataMasker.jsonParse(it.response.body);
    return {
      code: "RUNTIME_ERROR",
      message: `statusCode: ${it.response.statusCode}, errorCode: ${responseObj?.error?.code}, errorMessage: ${responseObj?.error?.message}`,
      severity: "Error",
      detail: this.dataMasker.jsonStringify(it.response.body),
    };
  }

  public async generateReport() {
    if (this.opts.apiScenarioFilePath !== undefined) {
      this.testDefFile = await this.testResourceLoader.load(this.opts.apiScenarioFilePath);
    }
    await this.swaggerAnalyzer.initialize();
    await this.initialize();
    await this.generateApiScenarioTestResult(this.rawReport!);

    await this.outputReport();
  }

  private async outputReport() {
    if (this.opts.reportOutputFilePath !== undefined) {
      console.log(`Write generated report file: ${this.opts.reportOutputFilePath}`);
      await this.fileLoader.writeFile(
        this.opts.reportOutputFilePath,
        JSON.stringify(this.swaggerExampleQualityResult, null, 2)
      );
    }
    if (this.opts.markdownReportPath) {
      await this.fileLoader.appendFile(
        this.opts.markdownReportPath,
        generateMarkdownReport(this.swaggerExampleQualityResult)
      );
    }
    if (this.opts.junitReportPath) {
      await this.junitReporter.addSuiteToBuild(
        this.swaggerExampleQualityResult,
        this.opts.junitReportPath
      );
    }
    if (this.opts.htmlReportPath) {
      await this.generateHtmlReport();
    }
  }

  private async generateHtmlReport() {
    const operationIdCoverageResult = this.swaggerAnalyzer.calculateOperationCoverageBySpec(
      this.testDefFile!
    );

    const operationCoverageResult: OperationCoverageInfo[] = [];
    operationIdCoverageResult.forEach((result, key) => {
      let specPath = this.fileLoader.resolvePath(key);
      specPath = `https://github.com/Azure/azure-rest-api-specs/blob/main/${specPath.substring(
        specPath.indexOf("specification")
      )}`;
      operationCoverageResult.push({
        totalOperations: result.totalOperationNumber,
        spec: specPath,
        coverageRate: result.coverage,
        apiVersion: getApiVersionFromSwaggerPath(specPath),
        unCoveredOperations: result.uncoveredOperationIds.length,
        coveredOperaions: result.totalOperationNumber - result.uncoveredOperationIds.length,
        validationFailOperations: this.trafficValidationResult.filter(
          (it) =>
            it.specFilePath === key && (it.runtimeExceptions!.length > 0 || it.errors!.length > 0)
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
      reportPath: this.opts.htmlReportPath,
      overrideLinkInReport: false,
      outputExceptionInReport: true,
      sdkPackage: this.swaggerExampleQualityResult.providerNamespace,
    };

    const generator = new HtmlReportGenerator(
      this.trafficValidationResult,
      operationCoverageResult,
      0,
      options
    );
    await generator.generateHtmlReport();
  }
}
