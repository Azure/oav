import { inject, injectable } from "inversify";
import uuid from "uuid";
import { defaultQualityReportFilePath } from "./defaultNaming";
import { setDefaultOpts } from "./../swagger/loader";
import { ReportGenerator, ReportGeneratorOption } from "./reportGenerator";
import { RawReport } from "./testResourceTypes";
import { inversifyGetInstance, TYPES } from "./../inversifyUtils";
import { NewmanReportParser, NewmanReportParserOption } from "./postmanReportParser";
import { getSwaggerFilePathsFromTestScenarioFilePath } from "./testResourceLoader";

export interface NewmanReportAnalyzerOption extends NewmanReportParserOption {
  reportOutputFilePath?: string;
  markdownReportPath?: string;
  junitReportPath?: string;
  enableUploadBlob?: boolean;
  runId?: string;
  swaggerFilePaths?: string[];
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
        ? getSwaggerFilePathsFromTestScenarioFilePath(testScenarioFilePath)
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
    };
    const reportGenerator = inversifyGetInstance(ReportGenerator, reportGeneratorOption);
    await reportGenerator.generateReport();
  }
}
