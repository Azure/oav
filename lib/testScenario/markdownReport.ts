import { readFileSync } from "fs";
import path from "path";
import Handlebars from "handlebars";
import * as hd from "humanize-duration";
import moment from "moment";
import { ResponseDiffItem, RuntimeError, StepResult, TestScenarioResult } from "./reportGenerator";

const spaceReg = /(\n|\t|\r)/gi;

const commonHelper = (opts: HelperOpts) => ({
  renderPlain: (s: string) => s,
  renderWhitespace: (n: number) => "&nbsp;".repeat(n),
  renderUri: (s: string) => `${path.join(opts.swaggerRootDir, s)}`,
  renderSymbol: (result: ResultState) => `${resultStateSymbol[result]}`,
  renderScenarioTitle: (ts: TestScenarioMarkdownResult) => {
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
  renderStepTitle: (ts: TestScenarioMarkdownStepResult) => {
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
  shouldReportError: (sr: TestScenarioMarkdownStepResult) =>
    sr.failedErrorsCount + sr.fatalErrorsCount > 0,
  renderFatalErrorCode: (e: RuntimeError) => `[${e.code}]()`,
  renderFatalErrorDetail: (e: RuntimeError) => `${e.message.replace(spaceReg, " ")}`,
  renderDiffErrorCode: (e: ResponseDiffItem) => `[${e.code}]()`,
  renderDiffErrorDetail: (e: ResponseDiffItem) => `${e.message.replace(spaceReg, " ")}`,
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

interface TestScenarioMarkdownStepResult {
  stepName: string;
  result: ResultState;
  exampleFilePath?: string;
  correlationId?: string;
  operationId: string;
  fatalErrorsCount: number;
  failedErrorsCount: number;
  warningErrorsCount: number;
  runtimeError?: RuntimeError[];
  responseDiffResult?: ResponseDiffItem[];
}

interface TestScenarioMarkdownResult {
  testScenarioName: string;
  result: ResultState;
  swaggerFilePaths: string[];
  startTime: Date;
  endTime: Date;
  runId: string;
  fatalStepsCount: number;
  failedStepsCount: number;
  warningStepsCount: number;
  steps: TestScenarioMarkdownStepResult[];
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

const generateMarkdownReportView = compileHandlebarsTemplate<TestScenarioMarkdownResult>(
  "markdownReport.handlebars",
  {
    swaggerRootDir: "root",
  }
);

const generateJUnitCaseReportView = compileHandlebarsTemplate<TestScenarioMarkdownStepResult>(
  "junitCaseReport.handlebars",
  {
    swaggerRootDir: "root",
  }
);

const stepIsFatal = (sr: StepResult) => sr.runtimeError && sr.runtimeError.length > 0;
const stepIsFailed = (sr: StepResult) => sr.responseDiffResult && sr.responseDiffResult.length > 0;

const asMarkdownStepResult = (sr: StepResult): TestScenarioMarkdownStepResult => {
  let result: ResultState = "succeeded";
  if (stepIsFatal(sr)) {
    result = "fatal";
  } else if (stepIsFailed(sr)) {
    result = "failed";
  }

  const r: TestScenarioMarkdownStepResult = {
    result,
    fatalErrorsCount: sr.runtimeError ? sr.runtimeError.length : 0,
    failedErrorsCount: sr.responseDiffResult ? sr.responseDiffResult.length : 0,
    warningErrorsCount: 0,
    ...sr,
  };
  return r;
};

const asMarkdownResult = (tsr: TestScenarioResult): TestScenarioMarkdownResult => {
  const fatalCount = tsr.stepResult.filter(
    (sr) => sr.runtimeError && sr.runtimeError.length > 0
  ).length;
  const errorCount = tsr.stepResult.filter(
    (sr) => sr.responseDiffResult && sr.responseDiffResult.length > 0
  ).length;
  let resultState: ResultState = "succeeded";
  if (fatalCount > 0) {
    resultState = "fatal";
  } else if (errorCount > 0) {
    resultState = "failed";
  } else {
    resultState = "succeeded";
  }

  const r: TestScenarioMarkdownResult = {
    testScenarioName: tsr.testScenarioName!,
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
export const generateMarkdownReport = (testScenarioResult: TestScenarioResult): string => {
  const result = asMarkdownResult(testScenarioResult);
  const body = generateMarkdownReportView(result);
  return body;
};
export const generateJUnitCaseReport = (sr: StepResult): string => {
  const result = asMarkdownStepResult(sr);
  const body = generateJUnitCaseReportView(result);
  return body;
};
