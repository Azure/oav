import "reflect-metadata";
import { ExampleGenerator } from "./exampleGenerator";

// oav generate-postmanCollection testScenario --env
const main = async () => {
  try {
    const generator = new ExampleGenerator(
      "/home/ruowan/work/oav/generated_reports/generated_report.json",
      "generated_examples"
    );
    generator.generateExamples();
  } catch (e) {
    console.log(e.message, e.stack);
  }
};

console.time("TestLoad");
console.log("Start");

main().finally(() => {
  console.timeEnd("TestLoad");
});
