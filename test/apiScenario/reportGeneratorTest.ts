import { inversifyGetInstance } from "../../lib/inversifyUtils";
import { NewmanReportParser } from "../../lib/apiScenario/postmanReportParser";
import { RawReport } from "../../lib/apiScenario/apiScenarioTypes";
import { ReportGenerator, ReportGeneratorOption } from "../../lib/apiScenario/reportGenerator";

describe("reportGenerator", () => {
  it("generate report - storage", async () => {
    const newmanReportFilePath =
      "test/apiScenario/fixtures/report/storageBasicExample.yaml/202207041617-tywsob/StorageBasicExample.json";
    const newmanReportParser = inversifyGetInstance(NewmanReportParser, {
      newmanReportFilePath,
    });
    const rawReport: RawReport = await newmanReportParser.generateRawReport(newmanReportFilePath);
    const apiScenarioFilePath = rawReport.metadata.apiScenarioFilePath;
    const reportGeneratorOption: ReportGeneratorOption = {
      newmanReportFilePath,
      apiScenarioFilePath,
      apiScenarioName: rawReport.metadata.apiScenarioName,
      swaggerFilePaths: rawReport.metadata.swaggerFilePaths,
      checkUnderFileRoot: false,
      eraseXmsExamples: false,
      eraseDescription: false,
      runId: "",
    };
    const reportGenerator = inversifyGetInstance(ReportGenerator, reportGeneratorOption);
    reportGeneratorOption.reportOutputFilePath = undefined;
    const report = await reportGenerator.generateReport();
    report.rootPath = "";
    report.stepResult.forEach((stepResult) => {
      stepResult.liveValidationResult?.requestValidationResult.errors.forEach((error) => {
        error.source = {
          ...error.source,
          url: "",
        };
      });
      stepResult.liveValidationResult?.responseValidationResult.errors.forEach((error) => {
        error.source = {
          ...error.source,
          url: "",
        };
      });
    });

    expect(report).toMatchSnapshot();
  });
});
