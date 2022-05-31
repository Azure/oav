import * as path from "path";
import { inject, injectable } from "inversify";
import { HttpHeaders } from "@azure/core-http";
import { inversifyGetInstance, TYPES } from "../../inversifyUtils";
import { parseValidationRequest } from "../../liveValidation/liveValidator";
import { OperationSearcher } from "../../liveValidation/operationSearcher";
import { JsonLoader } from "../../swagger/jsonLoader";
import * as C from "../../util/constants";
import { SwaggerLoader } from "../../swagger/swaggerLoader";
import { getTransformContext } from "../../transform/context";
import { extractPathParamValue, pathRegexTransformer } from "../../transform/pathRegexTransformer";
import { referenceFieldsTransformer } from "../../transform/referenceFieldsTransformer";
import { applyGlobalTransformers, applySpecTransformers } from "../../transform/transformer";
import { xmsPathsTransformer } from "../../transform/xmsPathsTransformer";
import { ApiScenarioLoader, ApiScenarioLoaderOption } from "../apiScenarioLoader";
import {
  RawScenarioDefinition,
  RawScenario,
  Scenario,
  StepRestCall,
  Variable,
  RawStepOperation,
} from "../apiScenarioTypes";
import { ApiScenarioClientRequest } from "../apiScenarioRunner";
import { Operation, Parameter, SwaggerExample } from "../../swagger/swaggerTypes";
import { unknownApiVersion, xmsLongRunningOperation } from "../../util/constants";
import { ArmApiInfo, ArmUrlParser } from "../armUrlParser";
import { SchemaValidator } from "../../swaggerValidator/schemaValidator";
import { getJsonPatchDiff } from "../diffUtils";

const glob = require("glob");

export type SingleRequestTracking = ApiScenarioClientRequest & {
  timeStart?: Date;
  timeEnd?: Date;
  url: string;
  responseBody: any;
  responseCode: number;
  responseHeaders: { [headerName: string]: string };
};

export interface RequestTracking {
  requests: SingleRequestTracking[];
  description: string;
}

export interface TestScenarioGeneratorOption extends ApiScenarioLoaderOption {
  specFolders: string[];
}

// const resourceGroupPathRegex = /^\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+$/i;

interface TestScenarioGenContext {
  resourceTracking: Map<string, StepRestCall>;
  resourceNames: Set<string>;
  variables: Scenario["variables"];
  lastUpdatedResource: string;
}

@injectable()
export class TestScenarioGenerator {
  private testDefToWrite: Array<{ testDef: RawScenarioDefinition; filePath: string }> = [];
  private operationSearcher: OperationSearcher;
  private idx: number = 0;
  private lroPollingUrls = new Set<string>();

  public constructor(
    @inject(TYPES.opts) private opts: TestScenarioGeneratorOption,
    private testResourceLoader: ApiScenarioLoader,
    private swaggerLoader: SwaggerLoader,
    private jsonLoader: JsonLoader,
    private armUrlParser: ArmUrlParser,
    @inject(TYPES.schemaValidator) private schemaValidator: SchemaValidator
  ) {
    this.operationSearcher = new OperationSearcher((_) => {});
  }
  public static create(opts: TestScenarioGeneratorOption) {
    return inversifyGetInstance(TestScenarioGenerator, opts);
  }

  public async initialize() {
    const swaggerFilePaths = await this.getSwaggerFilePaths();
    const transformCtx = getTransformContext(this.jsonLoader, this.schemaValidator, [
      xmsPathsTransformer,
      referenceFieldsTransformer,
      pathRegexTransformer,
    ]);

    for (const swaggerPath of swaggerFilePaths) {
      const swaggerSpec = await this.swaggerLoader.load(swaggerPath);
      applySpecTransformers(swaggerSpec, transformCtx);
      this.operationSearcher.addSpecToCache(swaggerSpec);
    }
    applyGlobalTransformers(transformCtx);
  }
  private async getSwaggerFilePaths() {
    return await this.getMatchedPaths(
      this.opts.specFolders.map((s) => path.join(path.resolve(s), "**/*.json"))
    );
  }

  private async getMatchedPaths(jsonsPattern: string | string[]): Promise<string[]> {
    let matchedPaths: string[] = [];
    if (typeof jsonsPattern === "string") {
      matchedPaths = glob.sync(jsonsPattern, {
        ignore: C.DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
    } else {
      for (const pattern of jsonsPattern) {
        const res: string[] = glob.sync(pattern, {
          ignore: C.DefaultConfig.ExcludedExamplesAndCommonFiles,
          nodir: true,
        });
        for (const path of res) {
          if (!matchedPaths.includes(path)) {
            matchedPaths.push(path);
          }
        }
      }
    }
    return matchedPaths;
  }

  public async writeGeneratedFiles() {
    const testDefToWrite = this.testDefToWrite;
    this.testDefToWrite = [];

    for (const { testDef, filePath } of testDefToWrite) {
      await this.testResourceLoader.writeTestDefinitionFile(filePath, testDef);
    }
  }

  public async generateTestDefinition(
    requestTracking: RequestTracking[],
    testScenarioFilePath: string
  ): Promise<RawScenarioDefinition> {
    const testDef: RawScenarioDefinition = {
      scope: "ResourceGroup",
      scenarios: [],
    };

    this.idx = 0;
    for (const track of requestTracking) {
      const testScenario = await this.generateTestScenario(track, testScenarioFilePath);
      testDef.scenarios.push(testScenario);
    }

    this.testDefToWrite.push({ testDef, filePath: testScenarioFilePath });

    return testDef;
  }

  private generateIdx() {
    return this.idx++;
  }

  private async generateTestScenario(
    requestTracking: RequestTracking,
    _: string // testDefFilePath
  ): Promise<RawScenario> {
    console.log(`\nGenerating ${requestTracking.description}`);
    const testScenario: RawScenario = {
      scenario: requestTracking.description,
      description: requestTracking.description,
      variables: {},
      steps: [],
    };

    const ctx: TestScenarioGenContext = {
      resourceTracking: new Map(),
      resourceNames: new Set(),
      variables: {},
      lastUpdatedResource: "",
    };

    const records = [...requestTracking.requests];
    let lastOperation: Operation | undefined = undefined;
    while (records.length > 0) {
      // const record = records[0];
      const testStep = await this.generateTestStepRestCall(records, ctx);
      if (!testStep) {
        continue;
      }

      const { step, operation } = testStep;
      if (lastOperation === operation && lastOperation?._method === "get") {
        // Skip same get operation
        continue;
      }

      lastOperation = operation;
      testScenario.steps.push(step);
    }

    testScenario.variables = Object.keys(ctx.variables).length > 0 ? ctx.variables : undefined;

    return testScenario;
  }

  private searchOperation(record: SingleRequestTracking) {
    const info = parseValidationRequest(record.url, record.method, "");
    try {
      const result = this.operationSearcher.search(info);
      return result.operationMatch;
    } catch (e) {
      return undefined;
    }
  }

  private async handleUnknownPath(
    record: SingleRequestTracking,
    records: SingleRequestTracking[]
  ): Promise<StepRestCall | undefined | null> {
    if (this.lroPollingUrls.has(record.url) && record.method === "GET") {
      return undefined;
    }

    switch (record.method) {
      case "GET":
        return null;

      case "DELETE":
      case "PUT":
        const armInfo = this.armUrlParser.parseArmApiInfo(record.path, record.method);
        await this.skipLroPoll(
          records,
          {
            [xmsLongRunningOperation]: true,
          } as Operation,
          record,
          armInfo
        );
        return null;
    }

    return null;
  }

  private async generateTestStepRestCall(
    records: SingleRequestTracking[],
    ctx: TestScenarioGenContext
  ): Promise<any | undefined | null> {
    const record = records.shift()!;
    const armInfo = this.armUrlParser.parseArmApiInfo(record.path, record.method);

    if (ctx.lastUpdatedResource === armInfo.resourceUri && record.method === "GET") {
      return undefined;
    }

    // TODO do not skip 404
    if (record.responseCode === 404) {
      console.info(`Skip 404 request:\t${record.method}\t${record.url}`);
      return undefined;
    }

    const parseResult = this.parseRecord(record);
    if (parseResult === undefined) {
      return await this.handleUnknownPath(record, records);
    }
    const { operation, requestParameters } = parseResult;
    const variables: Scenario["variables"] = {};

    for (const paramKey of Object.keys(requestParameters)) {
      const value = requestParameters[paramKey];
      if (unwantedParams.has(paramKey) || ctx.variables[paramKey]?.value === value) {
        continue;
      }
      let v: Variable;
      if (typeof value === "string") {
        v = { type: "string", value };
      } else if (typeof value === "object") {
        if (Array.isArray(value)) {
          v = { type: "array", value: value };
        } else {
          v = { type: "object", value: value };
        }
      } else {
        continue;
      }
      if (ctx.variables[paramKey] === undefined) {
        ctx.variables[paramKey] = v;
      } else {
        const old = ctx.variables[paramKey];
        if (old.type === v.type && (v.type === "object" || v.type === "array")) {
          const diff = getJsonPatchDiff(old.value!, v.value!);
          if (diff.length > 0) {
            v.patches = diff;
            v.value = undefined;
          }
        }
        variables[paramKey] = v;
      }
    }

    const step: RawStepOperation = {
      step: `${operation.operationId}_${this.generateIdx()}`,
      operationId: operation.operationId!,
      variables: Object.keys(variables).length > 0 ? variables : undefined,
    };

    await this.skipLroPoll(records, operation, record, armInfo);

    if (["PUT", "PATCH", "DELETE"].includes(record.method)) {
      // eslint-disable-next-line require-atomic-updates
      ctx.lastUpdatedResource = armInfo.resourceUri;
    }

    return { step, operation };
  }

  private async skipLroPoll(
    records: SingleRequestTracking[],
    _operation: Operation,
    initialRecord: SingleRequestTracking,
    armInfo: ArmApiInfo
  ) {
    let finalGet: SingleRequestTracking | undefined = undefined;

    const headers = new HttpHeaders(initialRecord.responseHeaders);
    for (const headerName of ["Operation-Location", "Azure-AsyncOperation", "Location"]) {
      const headerValue = headers.get(headerName);
      if (headerValue !== undefined && headerValue !== initialRecord.url) {
        this.lroPollingUrls.add(headerValue);
      }
    }

    while (records.length > 0) {
      const record = records.shift()!;
      if (record.method === "GET") {
        if (record.path === armInfo.resourceUri) {
          finalGet = record;
          continue;
        }
        if (this.lroPollingUrls.has(record.url)) {
          continue;
        }
      }

      records.unshift(record);
      break;
    }

    return finalGet;
  }

  private parseRecord(record: SingleRequestTracking) {
    const operationMatch = this.searchOperation(record);
    if (operationMatch === undefined) {
      return undefined;
    }

    const { operation } = operationMatch;

    const pathParamValue = extractPathParamValue(operationMatch);
    const requestParameters: SwaggerExample["parameters"] = {
      "api-version": unknownApiVersion,
      ...pathParamValue,
    };

    for (const p of operation.parameters ?? []) {
      const param = this.jsonLoader.resolveRefObj(p);
      const paramValue = getParamValue(record, param);
      if (paramValue !== undefined) {
        requestParameters[param.name] = paramValue;
      }
    }

    return { requestParameters, operation, pathParamValue };
  }
}

const unwantedParams = new Set(["resourceGroupName", "api-version", "subscriptionId"]);

const getParamValue = (record: SingleRequestTracking, param: Parameter) => {
  switch (param.in) {
    case "body":
      return record.body;

    case "header":
      return record.headers[param.name];

    case "query":
      return record.query[param.name];
  }

  return undefined;
};

const unwantedKeys = new Set(["etag"]);
const eraseUnwantedKeys = (obj: any) => {
  if (obj === null || obj === undefined) {
    return;
  }
  if (typeof obj !== "object") {
    return;
  }
  if (Array.isArray(obj)) {
    for (let idx = 0; idx < obj.length; ++idx) {
      eraseUnwantedKeys(obj[idx]);
    }
    return;
  }
  for (const key of Object.keys(obj)) {
    if (unwantedKeys.has(key.toLowerCase())) {
      obj[key] = undefined;
    } else if (typeof obj[key] === "object") {
      eraseUnwantedKeys(obj[key]);
    }
  }
};
