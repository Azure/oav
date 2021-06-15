import { injectable } from "inversify";
import { TestScenarioResult } from "./reportGenerator";

@injectable()
export class JUnitReporter {
  private builder: any;
  public constructor() {
    this.builder = require("junit-report-builder");
  }

  public addSuiteToBuild = async (tsr: TestScenarioResult, path: string) => {
    return new Promise((resolve, reject) => {
      try {
        const suite = this.builder.testSuite().name(tsr.testScenarioName);
        tsr.stepResult.forEach((sr) => {
          const tc = suite
            .testCase()
            .className(tsr.testScenarioName)
            .name(sr.stepName)
            .file(sr.exampleFilePath)
            .time(1000);
          if (sr.runtimeError && sr.runtimeError.length > 0) {
            tc.failure(sr.runtimeError[0].message, "RunTimeError");
          } else if (sr.responseDiffResult && sr.responseDiffResult.length > 0) {
            tc.error(
              sr.responseDiffResult.map((r) => r.message).join("\n"),
              "ValidationError",
              sr.responseDiffResult.map((r) => r.detail).join("\n")
            )
              .standardError(
                sr.responseDiffResult
                  .map((r) => `${r.message}\t${r.jsonPath}\n${r.detail}`)
                  .join("\n")
              )
              .errorAttachment(sr.exampleFilePath);
          } else {
            tc.standardOutput("This was written to stdout");
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
