import * as fs from "fs";
import * as path from "path";
import * as Mustache from "mustache";
import {
  OperationCoverageInfo,
  TrafficValidationIssue,
} from "../swaggerValidator/trafficValidator";

// used to pass data to the template rendering engine
export class CoverageView {
  public package: string;
  public generatedDate: Date;
  public validationResults: TrafficValidationIssue[];
  public coverageResults: OperationCoverageInfo[];
  public undefinedOperationCount: number;
  public language: string;
  public generalErrorResults: Map<string, TrafficValidationIssue[]>;

  public constructor(
    validationResults: TrafficValidationIssue[],
    coverageResults: OperationCoverageInfo[],
    undefinedOperationCount: number = 0,
    packageName: string = "",
    language: string = ""
  ) {
    this.package = packageName;
    this.validationResults = validationResults;
    this.coverageResults = coverageResults;
    this.undefinedOperationCount = undefinedOperationCount;
    this.generatedDate = new Date();
    this.language = language;
    this.generalErrorResults = new Map();
  }

  public formatGeneratedDate(): string {
    const day = this.generatedDate.getDate();
    const month = this.generatedDate.getMonth() + 1;
    const year = this.generatedDate.getFullYear();
    const hours = this.generatedDate.getHours();
    const minutes = this.generatedDate.getMinutes();

    return (
      year +
      "-" +
      (month < 10 ? "0" + month : month) +
      "-" +
      (day < 10 ? "0" + day : day) +
      " at " +
      hours +
      ":" +
      (minutes < 10 ? "0" + minutes : minutes) +
      (hours < 13 ? "AM" : "PM")
    );
  }

  public getTotalErrors(): number {
    return this.validationResults.length;
  }

  public getGeneralErrors(): TrafficValidationIssue[] {
    return this.validationResults.filter((x) => {
      return x.errors && x.errors.length > 0;
    });
  }

  public getTotalGeneralErrors(): number {
    return this.getGeneralErrors().length;
  }

  public getRunTimeErrors(): TrafficValidationIssue[] {
    return this.validationResults.filter((x) => {
      return x.runtimeExceptions && x.runtimeExceptions.length > 0;
    });
  }

  public getTotalRunTimeErrors(): number {
    return this.getRunTimeErrors().length;
  }
}

export class ReportGenerator {
  private sdkPackage: string;
  private sdkLanguage: string;
  private validationResults: TrafficValidationIssue[];
  private coverageResults: OperationCoverageInfo[];
  private undefinedOperationsCount: number;
  private reportPath: string;

  public constructor(
    validationResults: TrafficValidationIssue[],
    coverageResults: OperationCoverageInfo[],
    undefinedOperationResults: number,
    reportPath: string,
    sdkPackage: string = "",
    sdkLanguage: string = ""
  ) {
    this.validationResults = validationResults;
    this.coverageResults = coverageResults;
    this.undefinedOperationsCount = undefinedOperationResults;
    this.reportPath = path.resolve(process.cwd(), reportPath);
    this.sdkLanguage = sdkLanguage;
    this.sdkPackage = sdkPackage;
  }

  public generateHtmlReport() {
    const templatePath = path.resolve(process.cwd(), "dist/lib/templates/baseLayout.mustache");
    const template = fs.readFileSync(templatePath, "utf-8");
    const view = new CoverageView(
      this.validationResults,
      this.coverageResults,
      this.undefinedOperationsCount,
      this.sdkPackage,
      this.sdkLanguage
    );

    const general_errors = view.getGeneralErrors();
    const runtime_errors = view.getRunTimeErrors();

    console.log(general_errors);
    console.log(runtime_errors);

    const text = Mustache.render(template, view);
    fs.writeFileSync(this.reportPath, text, "utf-8");
  }
}
