import { inject, injectable } from "inversify";
import uuid from "uuid";
import { setDefaultOpts } from "../swagger/loader";
import { inversifyGetInstance, TYPES } from "../inversifyUtils";
import { defaultQualityReportFilePath } from "./defaultNaming";
import { ReportGenerator, ReportGeneratorOption, ValidationLevel } from "./reportGenerator";
import { RawReport } from "./apiScenarioTypes";
import { NewmanReportParser, NewmanReportParserOption } from "./postmanReportParser";
import { getSwaggerFilePathsFromApiScenarioFilePath } from "./apiScenarioYamlLoader";

export interface NewmanReportAnalyzerOption extends NewmanReportParserOption {
  reportOutputFilePath?: string;
  markdownReportPath?: string;
  junitReportPath?: string;
  enableUploadBlob?: boolean;
  runId?: string;
  swaggerFilePaths?: string[];
  validationLevel?: ValidationLevel;
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
      swaggerFilePaths: [],
      validationLevel: "validate-request-response",
      verbose: false,
    });
  }

  public async analyze() {
    const rawReport: RawReport = await this.newmanReportParser.generateRawReport(
      this.opts.newmanReportFilePath
    );
    const testScenarioFilePath = rawReport.metadata.testScenarioFilePath;
    const testScenarioName = rawReport.metadata.testScenarioName;
    const swaggerFilePaths =
      this.opts.swaggerFilePaths?.length === 0
        ? getSwaggerFilePathsFromApiScenarioFilePath(testScenarioFilePath)
        : this.opts.swaggerFilePaths;
    const reportGeneratorOption: ReportGeneratorOption = {
      newmanReportFilePath: this.opts.newmanReportFilePath,
      swaggerFilePaths: swaggerFilePaths,
      testDefFilePath: testScenarioFilePath,
      checkUnderFileRoot: false,
      eraseXmsExamples: false,
      eraseDescription: false,
      reportOutputFilePath: this.opts.reportOutputFilePath,
      markdownReportPath: this.opts.markdownReportPath,
      junitReportPath: this.opts.junitReportPath,
      enableBlobUploader: this.opts.enableUploadBlob || false,
      blobConnectionString: process.env.blobConnectionString || "",
      runId: this.opts.runId,
      testScenarioName: testScenarioName,
      validationLevel: this.opts.validationLevel,
      verbose: this.opts.verbose,
    };
    const reportGenerator = inversifyGetInstance(ReportGenerator, reportGeneratorOption);
    await reportGenerator.generateReport();
  }
}
