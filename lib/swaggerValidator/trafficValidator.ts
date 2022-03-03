import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { LiveValidationIssue, LiveValidator } from "../liveValidation/liveValidator";
import { DefaultConfig } from "../util/constants";
import { ErrorCodeConstants } from "../util/errorDefinitions";
import { OperationContext } from "../liveValidation/operationValidator";
import { Options } from "../validate"

export interface TrafficValidationOptions extends Options {
  sdkPackage?: string,
  sdkLanguage?: string,
  reportPath?: string,
}
export interface TrafficValidationIssue {
  payloadFilePath?: string;
  specFilePath?: string;
  errors?: LiveValidationIssue[];
  operationInfo?: OperationContext;
  runtimeExceptions?: RuntimeException[];
}

export interface RuntimeException {
  code: string;
  message: string;
}

export class TrafficValidator {
  private liveValidator: LiveValidator;
  private trafficValidationResult: TrafficValidationIssue[] = [];
  private trafficFiles: string[] = [];
  private specPath: string;
  private trafficPath: string;

  public constructor(specPath: string, trafficPath: string) {
    this.specPath = specPath;
    this.trafficPath = trafficPath;
  }

  public async initialize() {
    const specPathStats = fs.statSync(this.specPath);
    const trafficPathStats = fs.statSync(this.trafficPath);
    let specFileDirectory = "";
    let swaggerPathsPattern = "**/*.json";
    if (specPathStats.isFile()) {
      specFileDirectory = path.dirname(this.specPath);
      swaggerPathsPattern = path.basename(this.specPath);
    } else if (specPathStats.isDirectory()) {
      specFileDirectory = this.specPath;
    }
    if (trafficPathStats.isFile()) {
      this.trafficFiles.push(this.trafficPath);
    } else if (trafficPathStats.isDirectory()) {
      const searchPattern = path.join(this.trafficPath, "**/*.json");
      const matchedPaths = glob.sync(searchPattern, {
        nodir: true,
      });
      for (const filePath of matchedPaths) {
        this.trafficFiles.push(filePath);
      }
    }

    const liveValidationOptions = {
      checkUnderFileRoot: false,
      loadValidatorInBackground: false,
      directory: specFileDirectory,
      swaggerPathsPattern: [swaggerPathsPattern],
      excludedSwaggerPathsPattern: DefaultConfig.ExcludedExamplesAndCommonFiles,
      git: {
        shouldClone: false,
      },
    };

    this.liveValidator = new LiveValidator(liveValidationOptions);
    await this.liveValidator.initialize();
  }

  public async validate(): Promise<TrafficValidationIssue[]> {
    let payloadFilePath;
    try {
      for (const trafficFile of this.trafficFiles) {
        payloadFilePath = trafficFile;
        const payload = require(trafficFile);
        const validationResult = await this.liveValidator.validateLiveRequestResponse(payload);
        const operationInfo = validationResult.requestValidationResult?.operationInfo;
        const errorResult: LiveValidationIssue[] = [];
        const runtimeExceptions: RuntimeException[] = [];
        if (validationResult.requestValidationResult.isSuccessful === undefined) {
          runtimeExceptions.push(validationResult.requestValidationResult.runtimeException!);
        } else if (validationResult.requestValidationResult.isSuccessful === false) {
          errorResult.push(...validationResult.requestValidationResult.errors);
        }

        if (validationResult.responseValidationResult.isSuccessful === undefined) {
          runtimeExceptions.push(validationResult.responseValidationResult.runtimeException!);
        } else if (validationResult.responseValidationResult.isSuccessful === false) {
          errorResult.push(...validationResult.responseValidationResult.errors);
        }
        if (errorResult.length > 0 || runtimeExceptions.length > 0) {
          this.trafficValidationResult.push({
            payloadFilePath,
            errors: errorResult,
            runtimeExceptions,
            operationInfo: operationInfo,
          });
        }
      }
    } catch (err) {
      const msg = `Detail error message:${err?.message}. ErrorStack:${err?.Stack}`;
      this.trafficValidationResult.push({
        payloadFilePath,
        runtimeExceptions: [
          {
            code: ErrorCodeConstants.RUNTIME_ERROR,
            message: msg,
          },
        ],
      });
    }
    return this.trafficValidationResult;
  }
}
