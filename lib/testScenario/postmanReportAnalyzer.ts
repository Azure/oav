import { inject, injectable } from "inversify";
import { defaultQualityReportFilePath } from "./postmanItemNaming";
import { setDefaultOpts } from "./../swagger/loader";
import { ReportGenerator, ReportGeneratorOption } from "./reportGenerator";
import { RawReport } from "./testResourceTypes";
import { inversifyGetInstance, TYPES } from "./../inversifyUtils";
import { NewmanReportParser, NewmanReportParserOption } from "./postmanReportParser";
import { getSwaggerFilePathsFromTestScenarioFilePath } from "./testResourceLoader";

export interface NewmanReportAnalyzerOption extends NewmanReportParserOption {
  reportOutputFilePath?: string;
  enableUploadBlob?: boolean;
}

@injectable()
export class NewmanReportAnalyzer {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: NewmanReportAnalyzerOption,
    private newmanReportParser: NewmanReportParser
  ) {
    setDefaultOpts(this.opts, {
      newmanReportFilePath: "",
      reportOutputFilePath: defaultQualityReportFilePath(this.opts.newmanReportFilePath),
    });
  }

  public async analyze() {
    const rawReport: RawReport = await this.newmanReportParser.generateRawReport();
    const testScenarioFilePath = rawReport.metadata.testScenarioFilePath;
    const swaggerFilePaths = getSwaggerFilePathsFromTestScenarioFilePath(testScenarioFilePath);
    const reportGeneratorOption: ReportGeneratorOption = {
      newmanReportFilePath: this.opts.newmanReportFilePath,
      swaggerFilePaths: swaggerFilePaths,
      testDefFilePath: testScenarioFilePath,
      checkUnderFileRoot: false,
      eraseXmsExamples: false,
      eraseDescription: false,
      reportOutputFilePath: this.opts.reportOutputFilePath,
      enableBlobUploader: this.opts.enableUploadBlob || false,
      blobConnectionString: process.env.blobConnectionString || "",
    };
    const reportGenerator = inversifyGetInstance(ReportGenerator, reportGeneratorOption);
    await reportGenerator.generateReport();
  }
}
