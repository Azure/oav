import "reflect-metadata";
import { ReportGenerator } from "./reportGenerator";

// oav generate-postmanCollection testScenario --env
const main = async () => {
  try {
    const generator = new ReportGenerator(
      "/home/ruowan/work/oav/generated_reports/generated_report.json",
      "generated_examples",
      "",
      [],
      "",
      ""
    );
    await generator.generateReport();
  } catch (e) {
    console.log(e.message, e.stack);
  }
};

console.time("TestLoad");
console.log("Start");

main().finally(() => {
  console.timeEnd("TestLoad");
});
