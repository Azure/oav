import * as path from "path";
import { findReadMe } from "@azure/openapi-markdown";
import { inject, injectable } from "inversify";
import { TYPES } from "../inversifyUtils";
import {
  LiveValidationResult,
  LiveValidator,
  RequestResponseLiveValidationResult,
  RequestResponsePair,
} from "../liveValidation/liveValidator";
import { LiveRequest, LiveResponse } from "../liveValidation/operationValidator";
import { FileLoader } from "../swagger/fileLoader";
import { setDefaultOpts } from "../swagger/loader";
import { SwaggerExample } from "../swagger/swaggerTypes";
import { SeverityString } from "../util/severity";
import { getApiVersionFromFilePath, getProviderFromFilePath } from "../util/utils";
import { logger } from "./logger";
import { ApiScenarioLoaderOption } from "./apiScenarioLoader";
import { NewmanExecution, NewmanReport, Scenario, Step, StepRestCall } from "./apiScenarioTypes";
import { DataMasker } from "./dataMasker";
import { JUnitReporter } from "./junitReport";
import { generateMarkdownReport } from "./markdownReport";
import { SwaggerAnalyzer } from "./swaggerAnalyzer";

export interface ApiScenarioTestResult {
  apiScenarioFilePath: string;
  readmeFilePath?: string;
  swaggerFilePaths: string[];
  operationIds?: {
    [specPath: string]: string[];
  };
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
  armEndpoint?: string;
  apiScenarioName?: string;
  stepResult: StepResult[];
}

export interface StepResult {
  statusCode: number;
  specFilePath?: string;
  exampleFilePath?: string;
  example?: SwaggerExample;
  payloadPath?: string;
  operationId: string;
  responseTime?: number;
  stepName: string;
  runtimeError?: RuntimeError[];
  liveValidationResult?: RequestResponseLiveValidationResult;
  roundtripValidationResult?: LiveValidationResult;
}

export interface RuntimeError {
  code: string;
  message: string;
  detail: string;
  severity: SeverityString;
}

export interface NewmanReportValidatorOption extends ApiScenarioLoaderOption {
  apiScenarioFilePath: string;
  reportOutputFilePath: string;
  markdown?: boolean;
  junit?: boolean;
  html?: boolean;
  armEndpoint?: string;
  runId?: string;
  skipValidation?: boolean;
  savePayload?: boolean;
  generateExample?: boolean;
}

@injectable()
export class NewmanReportValidator {
  private scenario: Scenario;
  private testResult: ApiScenarioTestResult;
  private fileRoot: string;
  private liveValidator: LiveValidator;
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: NewmanReportValidatorOption,
    private fileLoader: FileLoader,
    private dataMasker: DataMasker,
    private swaggerAnalyzer: SwaggerAnalyzer,
    private junitReporter: JUnitReporter
  ) {
    setDefaultOpts(this.opts, {
      skipValidation: false,
      savePayload: false,
      generateExample: false,
    } as NewmanReportValidatorOption);
  }

  public async initialize(scenario: Scenario) {
    this.scenario = scenario;

    this.fileRoot =
      (await findReadMe(this.opts.apiScenarioFilePath)) ||
      path.dirname(this.opts.apiScenarioFilePath);

    this.testResult = {
      apiScenarioFilePath: path.relative(this.fileRoot, this.opts.apiScenarioFilePath),
      swaggerFilePaths: this.opts.swaggerFilePaths!.map((specPath) => {
        if (process.env.REPORT_SPEC_PATH_PREFIX) {
          specPath = path.join(
            process.env.REPORT_SPEC_PATH_PREFIX,
            specPath.substring(specPath.indexOf("specification"))
          );
        }
        return specPath;
      }),
      providerNamespace: getProviderFromFilePath(this.opts.apiScenarioFilePath),
      apiVersion: getApiVersionFromFilePath(this.opts.apiScenarioFilePath),
      runId: this.opts.runId,
      rootPath: this.fileRoot,
      repository: process.env.SPEC_REPOSITORY,
      branch: process.env.SPEC_BRANCH,
      commitHash: process.env.COMMIT_HASH,
      environment: process.env.ENVIRONMENT || "test",
      apiScenarioName: this.scenario.scenario,
      armEndpoint: this.opts.armEndpoint,
      stepResult: [],
    };

    await this.swaggerAnalyzer.initialize();

    this.liveValidator = new LiveValidator({
      fileRoot: "/",
      swaggerPaths: [...this.opts.swaggerFilePaths!],
      enableRoundTripValidator: !this.opts.skipValidation,
    });
    if (!this.opts.skipValidation) {
      await this.liveValidator.initialize();
    }
  }

  public async generateReport(rawReport: NewmanReport) {
    await this.generateApiScenarioTestResult(rawReport);

    await this.outputReport();
  }

  private async generateApiScenarioTestResult(newmanReport: NewmanReport) {
    const variables = newmanReport.variables;
    this.testResult.operationIds = this.swaggerAnalyzer.getOperations();
    this.testResult.startTime = new Date(newmanReport.timings.started).toISOString();
    this.testResult.endTime = new Date(newmanReport.timings.completed).toISOString();
    this.testResult.subscriptionId = variables.subscriptionId.value as string;
    const visitedIds = new Set<string>();
    for (const it of newmanReport.executions) {
      if (it.annotation === undefined) {
        continue;
      }
      if (it.annotation.type === "simple" || it.annotation.type === "LRO") {
        if (visitedIds.has(it.id)) {
          continue;
        }
        visitedIds.add(it.id);
        const runtimeError: RuntimeError[] = [];
        const matchedStep = this.getMatchedStep(it.annotation.step) as StepRestCall;

        // Runtime errors
        if (it.response.statusCode >= 400) {
          const error = this.getRuntimeError(it);
          runtimeError.push(error);
        }
        if (matchedStep === undefined) {
          continue;
        }

        if (matchedStep.externalReference) {
          continue;
        }

        it.assertions.forEach((assertion) => {
          runtimeError.push({
            code: "ASSERTION_ERROR",
            message: `${assertion.message}`,
            severity: "Error",
            detail: this.dataMasker.jsonStringify(assertion.stack),
          });
        });

        const payload = this.convertToLiveValidationPayload(it);

        let payloadFilePath;
        if (this.opts.savePayload) {
          payloadFilePath = `./payloads/${matchedStep.step}.json`;
          await this.fileLoader.writeFile(
            path.resolve(path.dirname(this.opts.reportOutputFilePath), payloadFilePath),
            JSON.stringify(payload, null, 2)
          );
        }

        if (this.opts.generateExample) {
          const statusCode = `${it.response.statusCode}`;
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

          const exampleFilePath = `./examples/${matchedStep.operationId}_${statusCode}.json`;
          await this.fileLoader.writeFile(
            path.resolve(path.dirname(this.opts.reportOutputFilePath), exampleFilePath),
            JSON.stringify(generatedExample, null, 2)
          );
        }

        // Schema validation
        const liveValidationResult = !this.opts.skipValidation
          ? await this.liveValidator.validateLiveRequestResponse(payload)
          : undefined;

        // Roundtrip validation
        let roundtripValidationResult = undefined;
        if (
          !this.opts.skipValidation &&
          matchedStep.isManagementPlane &&
          matchedStep.operation._method === "put" &&
          it.response.statusCode >= 200 &&
          it.response.statusCode <= 202
        ) {
          if (it.annotation.type === "LRO") {
            // For LRO, get the final response to compose payload
            const lroFinal = this.getLROFinalResponse(newmanReport.executions, it.annotation.step);
            if (lroFinal !== undefined && lroFinal.response.statusCode === 200) {
              const lroPayload = this.convertToLROLiveValidationPayload(it, lroFinal);
              roundtripValidationResult = await this.liveValidator.validateRoundTrip(lroPayload);
            }
          } else if (it.annotation.type === "simple") {
            roundtripValidationResult = await this.liveValidator.validateRoundTrip(payload);
          }
        }

        this.testResult.stepResult.push({
          specFilePath: matchedStep.operation._path._spec._filePath,
          operationId: it.annotation.operationId,
          payloadPath: payloadFilePath
            ? path.join(
                path.basename(path.dirname(this.opts.reportOutputFilePath)),
                payloadFilePath
              )
            : undefined,
          runtimeError,
          responseTime: it.response.responseTime,
          statusCode: it.response.statusCode,
          stepName: it.annotation.step,
          liveValidationResult,
          roundtripValidationResult,
        });
      }
    }
  }

  private convertToLiveValidationPayload(execution: NewmanExecution): RequestResponsePair {
    const request = execution.request;
    const response = execution.response;
    const liveRequest: LiveRequest = {
      url: request.url,
      method: request.method.toLowerCase(),
      headers: request.headers,
      body: this.parseBody(request.body),
    };
    const liveResponse: LiveResponse = {
      statusCode: response.statusCode.toString(),
      headers: response.headers,
      body: this.parseBody(response.body),
    };
    return {
      liveRequest,
      liveResponse,
    };
  }

  private convertToLROLiveValidationPayload(
    putReq: NewmanExecution,
    getReq: NewmanExecution
  ): RequestResponsePair {
    const request = putReq.request;
    const response = getReq.response;
    const liveRequest: LiveRequest = {
      url: request.url,
      method: request.method.toLowerCase(),
      headers: request.headers,
      body: this.parseBody(request.body),
    };
    const liveResponse: LiveResponse = {
      statusCode: response.statusCode.toString(),
      headers: response.headers,
      body: this.parseBody(response.body),
    };
    return {
      liveRequest,
      liveResponse,
    };
  }

  // body may not be json string
  private parseBody(body: string): any {
    try {
      return JSON.parse(body);
    } catch (e) {
      return body ? body : undefined;
    }
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

  private getLROFinalResponse(executions: NewmanExecution[], initialStep: string) {
    return executions.find(
      (it) => it.annotation?.type === "final-get" && it.annotation?.step === initialStep
    );
  }

  private getMatchedStep(stepName: string): Step | undefined {
    return this.scenario.steps?.find((s) => s.step === stepName);
  }

  private getRuntimeError(it: NewmanExecution): RuntimeError {
    const responseObj = this.dataMasker.jsonParse(it.response.body);
    return {
      code: `${it.response.statusCode >= 500 ? "SERVER_ERROR" : "CLIENT_ERROR"}`,
      message: `statusCode: ${it.response.statusCode}, errorCode: ${responseObj?.error?.code}, errorMessage: ${responseObj?.error?.message}`,
      severity: "Error",
      detail: this.dataMasker.jsonStringify(it.response.body),
    };
  }

  private async outputReport(): Promise<void> {
    if (this.opts.reportOutputFilePath !== undefined) {
      logger.info(`Write generated report file: ${this.opts.reportOutputFilePath}`);
      await this.fileLoader.writeFile(
        this.opts.reportOutputFilePath,
        JSON.stringify(this.testResult, null, 2)
      );
    }
    if (this.opts.markdown) {
      await this.fileLoader.appendFile(
        path.join(path.dirname(path.dirname(this.opts.reportOutputFilePath)), "report.md"),
        generateMarkdownReport(this.testResult)
      );
    }
    if (this.opts.junit) {
      await this.junitReporter.addSuiteToBuild(
        this.testResult,
        path.join(path.dirname(path.dirname(this.opts.reportOutputFilePath)), "junit.xml")
      );
    }
  }
}
