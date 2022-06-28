import { dirname } from "path";
import { inject, injectable } from "inversify";
import uuid from "uuid";
import { setDefaultOpts } from "../swagger/loader";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import { defaultQualityReportFilePath } from "./defaultNaming";
import { ReportGenerator, ReportGeneratorOption, ValidationLevel } from "./reportGenerator";
import { RawReport } from "./apiScenarioTypes";
import { NewmanReportParser, NewmanReportParserOption } from "./postmanReportParser";

export interface NewmanReportAnalyzerOption extends NewmanReportParserOption {
  reportOutputFilePath?: string;
  markdownReportPath?: string;
  junitReportPath?: string;
  runId?: string;
  swaggerFilePaths?: string[];
  validationLevel?: ValidationLevel;
  savePayload?: boolean;
  verbose?: boolean;
}

@injectable()
export class NewmanReportAnalyzer {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: NewmanReportAnalyzerOption,
    private newmanReportParser: NewmanReportParser
  ) {
    setDefaultOpts(this.opts, {
      runId: uuid.v4(),
      newmanReportFilePath: "",
      reportOutputFilePath: defaultQualityReportFilePath(this.opts.newmanReportFilePath),
      validationLevel: "validate-request-response",
      savePayload: false,
      verbose: false,
    });
  }

  public async analyze() {
    const rawReport: RawReport = await this.newmanReportParser.generateRawReport(
      this.opts.newmanReportFilePath
    );
    const apiScenarioFilePath = rawReport.metadata.apiScenarioFilePath;
    const reportGeneratorOption: ReportGeneratorOption = {
      newmanReportFilePath: this.opts.newmanReportFilePath,
      apiScenarioFilePath,
      apiScenarioName: rawReport.metadata.apiScenarioName,
      swaggerFilePaths: rawReport.metadata.swaggerFilePaths,
      checkUnderFileRoot: false,
      eraseXmsExamples: false,
      eraseDescription: false,
      reportOutputFilePath: this.opts.reportOutputFilePath,
      markdownReportPath: this.opts.markdownReportPath,
      junitReportPath: this.opts.junitReportPath,
      runId: this.opts.runId,
      validationLevel: this.opts.validationLevel,
      savePayload: this.opts.savePayload,
      verbose: this.opts.verbose,
      fileRoot: dirname(apiScenarioFilePath),
    };
    const reportGenerator = inversifyGetInstance(ReportGenerator, reportGeneratorOption);
    await reportGenerator.generateReport();
  }
}
