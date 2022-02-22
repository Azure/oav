import * as fs from "fs";
import * as path from "path";
import { glob } from "glob";
import { LiveValidationIssue, LiveValidator } from "../liveValidation/liveValidator";
import { DefaultConfig } from "../util/constants";
import { ErrorCodeConstants } from "../util/errorDefinitions";
import { OperationContext } from "../liveValidation/operationValidator";

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
  private trafficOperation: Map<string, Set<string>> = new Map<string, Set<string>>();
  public coverageResult: Map<string, number> = new Map<string, number>();

  public constructor(specPath: string, trafficPath: string) {
    this.specPath = specPath;
    this.trafficPath = trafficPath;
  }

  public async initialize() {
    console.log(`${this.trafficPath}, ${this.specPath}`);
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
    console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
    let payloadFilePath;
    console.log(`${this.trafficFiles.join("\n")}`);
    try {
      for (const trafficFile of this.trafficFiles) {
        console.log(`${trafficFile}`);
        payloadFilePath = trafficFile;
        console.log("0");
        const payload = require(trafficFile);
        console.log("1");
        const validationResult = await this.liveValidator.validateLiveRequestResponse(payload);
        console.log("2");
        const operationInfo = validationResult.requestValidationResult?.operationInfo;
        console.log(operationInfo.operationId);
        const swaggerFile = this.findSwaggerByOperationId(operationInfo.operationId);
        console.log(`Get swagger ${swaggerFile} by operationID ${operationInfo.operationId}`);
        if (swaggerFile !== undefined) {
          if (this.trafficOperation.get(swaggerFile) === undefined) {
            this.trafficOperation.set(swaggerFile, new Set<string>());
          }
          this.trafficOperation.get(swaggerFile)?.add(operationInfo.operationId);
          console.log(`add operaionid ${operationInfo.operationId} to trafficOperationMap ${swaggerFile}`)
        }

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
      console.log(`${err.message}`);
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
    this.liveValidator.operationSpecMapper.forEach((value: Set<string>, key: string) => {
      if (this.trafficOperation.get(key) === undefined) {
        this.coverageResult.set(key, 0);
      } else {
        if (value !== undefined) {
          this.coverageResult.set(key, this.trafficOperation.get(key)!.size / value.size);
        }
      }
    });
    this.coverageResult.forEach((value: number, key: string) => {
      console.log(`${key} - ${value}`);
    });
    return this.trafficValidationResult;
  }

  private findSwaggerByOperationId(OperationID: string) {
    let result = undefined;
    this.liveValidator.operationSpecMapper.forEach((value: Set<string>, key: string) => {
      if (value.has(OperationID)) {
        result = key;
      }
    });
    return result;
  }
}
