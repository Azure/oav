import "reflect-metadata";
import { inversifyGetInstance } from "./../inversifyUtils";
import { NewmanReportAnalyzerOption } from "./postmanReportAnalyzer";
import { NewmanReportParser } from "./postmanReportParser";

// oav generate-postmanCollection testScenario --env
const main = async () => {
  try {
    const opts: NewmanReportAnalyzerOption = {
      newmanReportFilePath:
        "/home/ruowan/work/oav/newman/newman-run-report-2021-02-09-07-44-08-992-0.json",
      reportOutputFilePath: "./generated_reports/generated_report.json",
    };
    const parser = inversifyGetInstance(NewmanReportParser, opts);
    await parser.generateRawReport();
  } catch (e) {
    console.log(e.message, e.stack);
  }
};

console.time("TestLoad");
console.log("Start");

main().finally(() => {
  console.timeEnd("TestLoad");
});
