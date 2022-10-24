import { readFileSync } from "fs";
import path from "path";
import Handlebars from "handlebars";
import * as hd from "humanize-duration";
import moment from "moment";
import {
  LiveValidationIssue,
  RequestResponseLiveValidationResult,
} from "../liveValidation/liveValidator";
import { RuntimeError, StepResult, ApiScenarioTestResult } from "./newmanReportValidator";

const spaceReg = /(\n|\t|\r)/gi;

const getErrorCodeDocLink = (code: string): string => {
  return `https://github.com/Azure/azure-rest-api-specs/blob/main/documentation/api-scenario/references/ErrorCodeReference.md#${code}`;
};

function getOavErrorCodeDocLink(code: string) {
  return `https://github.com/Azure/azure-rest-api-specs/blob/main/documentation/Semantic-and-Model-Violations-Reference.md#${code}`;
}

const commonHelper = (opts: HelperOpts) => ({
  renderPlain: (s: string) => s,
  renderWhitespace: (n: number) => "&nbsp;".repeat(n),
  renderUri: (s: string) => `${path.join(opts.swaggerRootDir, s)}`,
  renderSymbol: (result: ResultState) => `${resultStateSymbol[result]}`,
  renderScenarioTitle: (ts: ApiScenarioMarkdownResult) => {
    let s = `${ts.testScenarioName}`;
    if (ts.failedStepsCount <= 0 && ts.fatalStepsCount <= 0) {
      return s;
    }
    s = `${s}: `;
    if (ts.fatalStepsCount > 0) {
      s = `${s}${ts.fatalStepsCount} Fatal Step(s)`;
    }

    if (ts.fatalStepsCount > 0 && ts.failedStepsCount > 0) {
      s = `${s}, `;
    }

    if (ts.failedStepsCount > 0) {
      s = `${s} ${ts.failedStepsCount} Failed Step(s)`;
    }

    return s;
  },
  renderStepTitle: (ts: ApiScenarioMarkdownStepResult) => {
    let s = `${ts.stepName}`;
    if (ts.failedErrorsCount <= 0 && ts.fatalErrorsCount <= 0) {
      return s;
    }
    s = `${s}: `;
    if (ts.fatalErrorsCount > 0) {
      s = `${s}${ts.fatalErrorsCount} Fatal Error(s)`;
    }

    if (ts.fatalErrorsCount > 0 && ts.failedErrorsCount > 0) {
      s = `${s}, `;
    }

    if (ts.failedErrorsCount > 0) {
      s = `${s} ${ts.failedErrorsCount} Validation Error(s)`;
    }

    return s;
  },
  renderDuration: (start: Date, end: Date) =>
    `${hd.default(moment.duration(moment(end).diff(moment(start))).asMilliseconds())}`,
  renderResponseTime: (responseTime: number) => `${hd.default(responseTime)}`,
  shouldReportError: (sr: ApiScenarioMarkdownStepResult) =>
    sr.failedErrorsCount + sr.fatalErrorsCount > 0,
  renderFatalErrorCode: (e: RuntimeError) => `[${e.code}](${getErrorCodeDocLink(e.code)})`,
  renderFatalErrorDetail: (e: RuntimeError) => `${e.message.replace(spaceReg, " ")}`,
  renderLiveValidationErrorCode: (e: LiveValidationIssue) =>
    `[${e.code}](${getOavErrorCodeDocLink(e.code)})`,
  renderLiveValidationErrorDetail: (e: LiveValidationIssue) =>
    `${e.message.replace(spaceReg, " ")}`,
  shouldReportPayload: (e: string) => e !== undefined && e !== "",
});

type ResultState = keyof typeof ResultStateStrings;

const ResultStateStrings = {
  fatal: `Fatal`,
  failed: `Failed`,
  succeeded: `Succeeded`,
  warning: `Warning`,
};

export const resultStateSymbol: { [key in ResultState]: string } = {
  fatal: "❌",
  failed: "❌",
  succeeded: "️✔️",
  warning: "⚠️",
};

interface ApiScenarioMarkdownStepResult {
  stepName: string;
  result: ResultState;
  exampleFilePath?: string;
  payloadPath?: string;
  correlationId?: string;
  operationId: string;
  responseTime?: number;
  statusCode?: number;
  fatalErrorsCount: number;
  failedErrorsCount: number;
  warningErrorsCount: number;
  runtimeError?: RuntimeError[];
  liveValidationResult?: RequestResponseLiveValidationResult;
}

interface ApiScenarioMarkdownResult {
  testScenarioName: string;
  result: ResultState;
  swaggerFilePaths: string[];
  startTime: Date;
  endTime: Date;
  runId: string;
  fatalStepsCount: number;
  failedStepsCount: number;
  warningStepsCount: number;
  steps: ApiScenarioMarkdownStepResult[];
}

interface HelperOpts {
  swaggerRootDir: "root";
}

export const compileHandlebarsTemplate = <T>(fileName: string, opts: HelperOpts) => {
  const generationViewTemplate = readFileSync(
    path.join(__dirname, "templates", fileName)
  ).toString();
  const templateDelegate = Handlebars.compile<T>(generationViewTemplate, { noEscape: true });
  const helpers = commonHelper(opts);
  return (data: T) => templateDelegate(data, { helpers });
};

const generateMarkdownReportView = compileHandlebarsTemplate<ApiScenarioMarkdownResult>(
  "markdownReport.handlebars",
  {
    swaggerRootDir: "root",
  }
);

const generateJUnitCaseReportView = compileHandlebarsTemplate<ApiScenarioMarkdownStepResult>(
  "junitCaseReport.handlebars",
  {
    swaggerRootDir: "root",
  }
);

const stepIsFatal = (sr: StepResult) => sr.runtimeError && sr.runtimeError.length > 0;
const stepIsFailed = (sr: StepResult) =>
  (sr.liveValidationResult && sr.liveValidationResult.requestValidationResult.errors.length > 0) ||
  (sr.liveValidationResult && sr.liveValidationResult.responseValidationResult.errors.length > 0) ||
  (sr.roundtripValidationResult && sr.roundtripValidationResult.errors.length > 0);

const asMarkdownStepResult = (sr: StepResult): ApiScenarioMarkdownStepResult => {
  let result: ResultState = "succeeded";
  if (stepIsFatal(sr)) {
    result = "fatal";
  } else if (stepIsFailed(sr)) {
    result = "failed";
  }

  const failedErrorsCount =
    (sr.liveValidationResult ? sr.liveValidationResult.requestValidationResult.errors.length : 0) +
    (sr.liveValidationResult ? sr.liveValidationResult.responseValidationResult.errors.length : 0) +
    (sr.roundtripValidationResult ? sr.roundtripValidationResult.errors.length : 0);

  const r: ApiScenarioMarkdownStepResult = {
    result,
    fatalErrorsCount: sr.runtimeError ? sr.runtimeError.length : 0,
    failedErrorsCount: failedErrorsCount,
    warningErrorsCount: 0,
    ...sr,
  };
  return r;
};

const asMarkdownResult = (tsr: ApiScenarioTestResult): ApiScenarioMarkdownResult => {
  const fatalCount = tsr.stepResult.filter(
    (sr) => sr.runtimeError && sr.runtimeError.length > 0
  ).length;
  const errorCount = tsr.stepResult.filter((sr) => stepIsFailed(sr)).length;
  let resultState: ResultState = "succeeded";
  if (fatalCount > 0) {
    resultState = "fatal";
  } else if (errorCount > 0) {
    resultState = "failed";
  } else {
    resultState = "succeeded";
  }

  const r: ApiScenarioMarkdownResult = {
    testScenarioName: tsr.apiScenarioName!,
    result: resultState,
    swaggerFilePaths: tsr.swaggerFilePaths,
    startTime: new Date(tsr.startTime!),
    endTime: new Date(tsr.endTime!),
    runId: tsr.runId!,
    fatalStepsCount: fatalCount,
    failedStepsCount: errorCount,
    warningStepsCount: 0,
    steps: tsr.stepResult.map(asMarkdownStepResult),
  };

  return r;
};

export const generateMarkdownReportHeader = (): string => "<h3>Azure API Test Report</h3>";
export const generateMarkdownReport = (testScenarioResult: ApiScenarioTestResult): string => {
  const result = asMarkdownResult(testScenarioResult);
  const body = generateMarkdownReportView(result);
  return body;
};
export const generateJUnitCaseReport = (sr: StepResult): string => {
  const result = asMarkdownStepResult(sr);
  const body = generateJUnitCaseReportView(result);
  return body;
};
