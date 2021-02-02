import "reflect-metadata";
import { PostmanReportParser } from "./postmanReportParser";

// oav generate-postmanCollection testScenario --env
const main = async () => {
  try {
    const parser = new PostmanReportParser(
      "/home/ruowan/work/oav/newman/newman-run-report-2021-02-02-05-38-08-706-0.json",
      "./generated_reports/generated_report.json"
    );
    parser.generateRawReport();
  } catch (e) {
    console.log(e.message, e.stack);
  }
};

console.time("TestLoad");
console.log("Start");

main().finally(() => {
  console.timeEnd("TestLoad");
});
