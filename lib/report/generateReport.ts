import * as fs from "fs";
import * as path from "path";
import * as Mustache from "mustache";
import {
  OperationCoverageInfo,
  TrafficValidationIssue,
} from "../swaggerValidator/trafficValidator";

export interface TrafficValidationIssueForRendering extends TrafficValidationIssue {
  payloadFileLinkLabel?: string;
}

export interface OperationCoverageInfoForRendering extends OperationCoverageInfo {
  specLinkLabel?: string;
}

// used to pass data to the template rendering engine
export class CoverageView {
  public package: string;
  public language: string;
  public apiVersion: string = "unknown";
  public generatedDate: Date;  
  
  public undefinedOperationCount: number = 0;
  public operationValidated: number = 0;
  public operationFailed: number = 0;
  public operationUnValidated: number = 0;  
  public generalErrorResults: Map<string, TrafficValidationIssue[]>;

  public validationResultsForRendering: TrafficValidationIssueForRendering[] = [];
  public coverageResultsForRendering: OperationCoverageInfoForRendering[] = [];

  private validationResults: TrafficValidationIssue[];  
  private sortedValidationResults: TrafficValidationIssue[];
  private coverageResults: OperationCoverageInfo[];

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
    this.setMetrics();
    this.sortOperationIds();
    this.prepareDataForRendering();
  }

  private prepareDataForRendering() {
    const specLinkPrefix = "https://github.com/Azure/azure-rest-api-specs/blob/main/";
    const payloadLinkPrefix = "https://github.com/scbedd/oav-traffic-converter/blob/main/sample-tables-input/"

    try {
      this.sortedValidationResults.forEach(element => {
        let payloadFile =  element.payloadFilePath?.substring(element.payloadFilePath.lastIndexOf("/") + 1);
        this.validationResultsForRendering.push({
          payloadFilePath: `${payloadLinkPrefix}${payloadFile}`,
          payloadFileLinkLabel: payloadFile,
          errors: element.errors,
          operationInfo: element.operationInfo,
          runtimeExceptions: element.runtimeExceptions
        });
      });
      this.coverageResults.forEach(element => {
        this.coverageResultsForRendering.push({
          spec: `${specLinkPrefix}${element.spec?.substring(element.spec?.indexOf("specification"))}`,
          specLinkLabel: element.spec?.substring(element.spec?.lastIndexOf("/") + 1),
          apiVersion: element.apiVersion,
          coveredOperaions: element.coveredOperaions,
          validationFailOperations: element.validationFailOperations,
          unCoveredOperations: element.unCoveredOperations,
          unCoveredOperationsList: element.unCoveredOperationsList,
          totalOperations: element.totalOperations,
          coverageRate: element.coverageRate,
        });
      });
    }catch(e) {
      console.error(`Faile in prepareDataForRendering with err:${e?.stack};message:${e?.message}`);
    }
  }

  private sortOperationIds() {
    this.sortedValidationResults = this.validationResults.sort(function(op1, op2) {
      var opId1 = op1.operationInfo!.operationId;
      var opId2 = op2.operationInfo!.operationId;
      if (opId1 < opId2) {
        return -1;
      }
      if (opId1 > opId2) {
        return 1;
      }
      return 0;
    });
  }
  private setMetrics() {
    if (this.coverageResults?.length > 0) {
      this.apiVersion = this.coverageResults[0].apiVersion;
    }
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
    return this.validationResultsForRendering.filter((x) => {
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
