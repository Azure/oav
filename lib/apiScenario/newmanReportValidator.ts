import * as path from "path";
import { findReadMe } from "@azure/openapi-markdown";
import { inject, injectable } from "inversify";
import { TYPES } from "../inversifyUtils";
import {
  LiveValidationIssue,
  LiveValidator,
  RequestResponseLiveValidationResult,
  RequestResponsePair,
} from "../liveValidation/liveValidator";
import { LiveRequest, LiveResponse } from "../liveValidation/operationValidator";
import { ReportGenerator as HtmlReportGenerator } from "../report/generateReport";
import { FileLoader } from "../swagger/fileLoader";
import { setDefaultOpts } from "../swagger/loader";
import { SwaggerExample } from "../swagger/swaggerTypes";
import {
  OperationCoverageInfo,
  RuntimeException,
  TrafficValidationIssue,
  TrafficValidationOptions,
  unCoveredOperationsFormat,
} from "../swaggerValidator/trafficValidator";
import { SeverityString } from "../util/severity";
import { getApiVersionFromFilePath, getProviderFromFilePath } from "../util/utils";
import { ApiScenarioLoaderOption } from "./apiScenarioLoader";
import { NewmanExecution, NewmanReport, Scenario, Step, StepRestCall } from "./apiScenarioTypes";
import { DataMasker } from "./dataMasker";
import { getJsonPatchDiff } from "./diffUtils";
import { JUnitReporter } from "./junitReport";
import { generateMarkdownReport } from "./markdownReport";
import { SwaggerAnalyzer } from "./swaggerAnalyzer";
import { VariableEnv } from "./variableEnv";

interface GeneratedExample {
  step: string;
  operationId: string;
  example: SwaggerExample;
}

export interface ApiScenarioTestResult {
  apiScenarioFilePath: string;
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
  baseUrl?: string;
  apiScenarioName?: string;
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

export interface NewmanReportValidatorOption extends ApiScenarioLoaderOption {
  apiScenarioFilePath: string;
  reportOutputFilePath: string;
  markdownReportPath?: string;
  junitReportPath?: string;
  htmlReportPath?: string;
  baseUrl?: string;
  runId?: string;
  validationLevel?: ValidationLevel;
  savePayload?: boolean;
  generateExample?: boolean;
  verbose?: boolean;
}

@injectable()
export class NewmanReportValidator {
  private scenario: Scenario;
  private testResult: ApiScenarioTestResult;
  private fileRoot: string;
  private liveValidator: LiveValidator;
  private trafficValidationResult: TrafficValidationIssue[];
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: NewmanReportValidatorOption,
    private fileLoader: FileLoader,
    private dataMasker: DataMasker,
    private swaggerAnalyzer: SwaggerAnalyzer,
    private junitReporter: JUnitReporter
  ) {
    setDefaultOpts(this.opts, {
      validationLevel: "validate-request-response",
      savePayload: false,
      generateExample: false,
      verbose: false,
    } as NewmanReportValidatorOption);
  }

  public async initialize(scenario: Scenario) {
    this.scenario = scenario;

    this.fileRoot =
      (await findReadMe(this.opts.apiScenarioFilePath)) ||
      path.dirname(this.opts.apiScenarioFilePath);

    this.testResult = {
      apiScenarioFilePath: path.relative(this.fileRoot, this.opts.apiScenarioFilePath),
      swaggerFilePaths: this.opts.swaggerFilePaths!,
      providerNamespace: getProviderFromFilePath(this.opts.apiScenarioFilePath),
      apiVersion: getApiVersionFromFilePath(this.opts.apiScenarioFilePath),
      runId: this.opts.runId,
      rootPath: this.fileRoot,
      repository: process.env.SPEC_REPOSITORY,
      branch: process.env.SPEC_BRANCH,
      commitHash: process.env.COMMIT_HASH,
      environment: process.env.ENVIRONMENT || "test",
      apiScenarioName: this.scenario.scenario,
      baseUrl: this.opts.baseUrl,
      stepResult: [],
    };

    await this.swaggerAnalyzer.initialize();

    this.liveValidator = new LiveValidator({
      fileRoot: "/",
      swaggerPaths: [...this.opts.swaggerFilePaths!],
    });
    await this.liveValidator.initialize();
  }

  public async generateReport(rawReport: NewmanReport) {
    await this.generateApiScenarioTestResult(rawReport);

    await this.outputReport();
  }

  private async generateApiScenarioTestResult(newmanReport: NewmanReport) {
    this.trafficValidationResult = [];
    const variables = newmanReport.variables;
    this.testResult.startTime = new Date(newmanReport.timings.started).toISOString();
    this.testResult.endTime = new Date(newmanReport.timings.completed).toISOString();
    this.testResult.subscriptionId = variables.subscriptionId.value as string;
    for (const it of newmanReport.executions) {
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
          trafficValidationIssue.errors?.push(this.convertRuntimeException(error));
        }
        if (matchedStep === undefined) {
          continue;
        }

        trafficValidationIssue.specFilePath = matchedStep.operation._path._spec._filePath;

        const payload = this.convertToLiveValidationPayload(it);

        let responseDiffResult: ResponseDiffItem[] | undefined = undefined;
        const statusCode = `${it.response.statusCode}`;
        const exampleFilePath = `../examples/${matchedStep.operationId}_${statusCode}.json`;
        if (this.opts.generateExample || it.annotation.exampleName) {
          const generatedExample: SwaggerExample = {
            operationId: matchedStep.operationId,
            title: matchedStep.step,
            description: matchedStep.description,
            parameters: matchedStep._resolvedParameters!,
            responses: {
              [statusCode]: {
                headers: payload.liveResponse.headers,
                body: payload.liveResponse.body,
              },
            },
          };

          // Example validation
          if (this.opts.generateExample) {
            await this.fileLoader.writeFile(
              path.resolve(path.dirname(this.opts.reportOutputFilePath), exampleFilePath),
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
                    matchedStep,
                    newmanReport
                  )
                : [];
          }
        }

        // Schema validation
        const correlationId = it.response.headers["x-ms-correlation-request-id"];
        if (this.opts.savePayload) {
          const payloadFilePath = `../payloads/${matchedStep.step}_${correlationId}.json`;
          await this.fileLoader.writeFile(
            path.resolve(path.dirname(this.opts.reportOutputFilePath), payloadFilePath),
            JSON.stringify(payload, null, 2)
          );
          trafficValidationIssue.payloadFilePath = payloadFilePath;
        }
        const liveValidationResult = await this.liveValidator.validateLiveRequestResponse(payload);

        trafficValidationIssue.operationInfo =
          liveValidationResult.requestValidationResult.operationInfo;

        trafficValidationIssue.errors?.push(
          ...liveValidationResult.requestValidationResult.errors,
          ...liveValidationResult.responseValidationResult.errors
        );
        if (liveValidationResult.requestValidationResult.runtimeException) {
          trafficValidationIssue.errors?.push(
            this.convertRuntimeException(
              liveValidationResult.requestValidationResult.runtimeException
            )
          );
        }

        if (liveValidationResult.responseValidationResult.runtimeException) {
          trafficValidationIssue.errors?.push(
            this.convertRuntimeException(
              liveValidationResult.responseValidationResult.runtimeException
            )
          );
        }

        this.trafficValidationResult.push(trafficValidationIssue);

        this.testResult.stepResult.push({
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

  private convertToLiveValidationPayload(execution: NewmanExecution): RequestResponsePair {
    const request = execution.request;
    const response = execution.response;
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
    matchedStep: Step,
    rawReport: NewmanReport
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
            rawReport.variables,
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
    for (const it of this.scenario.steps ?? []) {
      if (stepName === it.step) {
        return it;
      }
    }
    return undefined;
  }

  private getRuntimeError(it: NewmanExecution): RuntimeError {
    const responseObj = this.dataMasker.jsonParse(it.response.body);
    return {
      code: "RUNTIME_ERROR",
      message: `statusCode: ${it.response.statusCode}, errorCode: ${responseObj?.error?.code}, errorMessage: ${responseObj?.error?.message}`,
      severity: "Error",
      detail: this.dataMasker.jsonStringify(it.response.body),
    };
  }

  private async outputReport(): Promise<void> {
    if (this.opts.reportOutputFilePath !== undefined) {
      console.log(`Write generated report file: ${this.opts.reportOutputFilePath}`);
      await this.fileLoader.writeFile(
        this.opts.reportOutputFilePath,
        JSON.stringify(this.testResult, null, 2)
      );
    }
    if (this.opts.markdownReportPath) {
      await this.fileLoader.writeFile(
        this.opts.markdownReportPath,
        generateMarkdownReport(this.testResult)
      );
    }
    if (this.opts.junitReportPath) {
      await this.junitReporter.addSuiteToBuild(this.testResult, this.opts.junitReportPath);
    }
    if (this.opts.htmlReportPath) {
      await this.generateHtmlReport();
    }
  }

  private async generateHtmlReport() {
    const operationIdCoverageResult = this.swaggerAnalyzer.calculateOperationCoverageBySpec(
      this.scenario._scenarioDef
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
        apiVersion: getApiVersionFromFilePath(specPath),
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
      sdkPackage: this.testResult.providerNamespace,
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
