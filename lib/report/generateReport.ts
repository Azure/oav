import * as Mustache from 'mustache';
import * as fs from "fs";
import * as path from "path";
import { TrafficValidationIssue } from '../swaggerValidator/trafficValidator';

// used to pass data to the template rendering engine
export class CoverageView {
  package: string;
  generatedDate: Date;
  validationResults: Array<TrafficValidationIssue>;
  language: string;
  generalErrorResults: Map<string, Array<TrafficValidationIssue>>;

  public constructor(validationResults: Array<TrafficValidationIssue>, packageName: string = "", language: string = "") {
    this.package = packageName;
    this.validationResults = validationResults;
    this.generatedDate = new Date();
    this.language = language;

    this.generalErrorResults = new Map();

  }

  formatGeneratedDate(): string {
    let day = this.generatedDate.getDate();
    let month = this.generatedDate.getMonth() + 1;
    let year = this.generatedDate.getFullYear();
    let hours = this.generatedDate.getHours();
    let minutes = this.generatedDate.getMinutes();

    return year + "-" 
        + (month < 10 ? "0" + month : month) + "-" 
        + (day < 10 ? "0" + day : day) + " at " 
        + hours + ":" + (minutes < 10 ? "0" + minutes : minutes) + (hours < 13 ? "AM" : "PM");
  }

  getTotalErrors(): number {
    return this.validationResults.length;
  }

  getGeneralErrors(): Array<TrafficValidationIssue>{
    return this.validationResults.filter((x) => {
        return x.errors && x.errors.length > 0;
    });
  }

  getTotalGeneralErrors(): number {
    return this.getGeneralErrors().length;
  }

  getRunTimeErrors(): Array<TrafficValidationIssue>{
    return this.validationResults.filter((x) => {
      return x.runtimeExceptions && x.runtimeExceptions.length > 0;
    });
  }

  getTotalRunTimeErrors(): number {
    return this.getRunTimeErrors().length;
  }
}

export class ReportGenerator {
  private sdkPackage: string;
  private sdkLanguage: string;
  private validationResults: Array<TrafficValidationIssue>;  
  private reportPath: string;

  public constructor(validationResult: Array<TrafficValidationIssue>, reportPath: string, sdkPackage: string = "", sdkLanguage: string = "") {
    this.validationResults = validationResult;
    this.reportPath = path.resolve(process.cwd(), reportPath);
    this.sdkLanguage = sdkLanguage;
    this.sdkPackage = sdkPackage;
  }

  public generateHtmlReport() {
    const templatePath = path.resolve(process.cwd(), "dist/lib/templates/baseLayout2.mustache");
    let template = fs.readFileSync(templatePath, "utf-8");
    let view = new CoverageView(this.validationResults, this.sdkPackage, this.sdkLanguage);

    let general_errors = view.getGeneralErrors();
    let runtime_errors = view.getRunTimeErrors();
    
    console.log(general_errors);
    console.log(runtime_errors);

    let text = Mustache.render(template, view);
    fs.writeFileSync(this.reportPath, text, "utf-8");
  }
}
