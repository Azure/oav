import { injectable } from "inversify";
import { ApiScenarioTestResult } from "./reportGenerator";
import { generateJUnitCaseReport } from "./markdownReport";

@injectable()
export class JUnitReporter {
  private builder: any;
  public constructor() {
    this.builder = require("junit-report-builder");
  }

  public addSuiteToBuild = async (tsr: ApiScenarioTestResult, path: string) => {
    return new Promise((resolve, reject) => {
      try {
        const suite = this.builder.testSuite().name(tsr.testScenarioName);
        tsr.stepResult.forEach((sr) => {
          const tc = suite
            .testCase()
            .className(tsr.testScenarioName)
            .name(`${tsr.testScenarioName}.${sr.stepName}`)
            .file(sr.exampleFilePath);
          if (sr.runtimeError && sr.runtimeError.length > 0) {
            const detail = generateJUnitCaseReport(sr);
            tc.failure(detail, "RunTimeError");
          } else if (sr.responseDiffResult && sr.responseDiffResult.length > 0) {
            const detail = generateJUnitCaseReport(sr);
            tc.failure(detail, "ValidationError").errorAttachment(sr.exampleFilePath);
          } else {
            tc.standardOutput("This step is completed successfully");
          }
        });
        this.builder.writeTo(path);
        resolve(suite);
      } catch (e) {
        reject(e);
      }
    });
  };

  public writeJUnit = async (path: string) => {
    return new Promise((resolve, reject) => {
      try {
        const r = this.builder.writeTo(path);
        resolve(r);
      } catch (e) {
        reject(e);
      }
    });
  };
}
