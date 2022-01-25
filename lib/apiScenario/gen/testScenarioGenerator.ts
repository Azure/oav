// import { join as pathJoin, relative as pathRelative, dirname } from "path";
import { default as jsonStringify } from "fast-json-stable-stringify";
import { inject, injectable } from "inversify";
import { HttpHeaders } from "@azure/core-http";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
import { inversifyGetInstance, TYPES } from "../../inversifyUtils";
import { parseValidationRequest } from "../../liveValidation/liveValidator";
import { OperationSearcher } from "../../liveValidation/operationSearcher";
import { JsonLoader } from "../../swagger/jsonLoader";
import { ExampleUpdateEntry, SwaggerLoader } from "../../swagger/swaggerLoader";
import { getTransformContext } from "../../transform/context";
import { extractPathParamValue, pathRegexTransformer } from "../../transform/pathRegexTransformer";
import { referenceFieldsTransformer } from "../../transform/referenceFieldsTransformer";
import { applyGlobalTransformers, applySpecTransformers } from "../../transform/transformer";
import { xmsPathsTransformer } from "../../transform/xmsPathsTransformer";
import { ApiScenarioLoader, ApiScenarioLoaderOption } from "../apiScenarioLoader";
import { RawScenarioDefinition, RawScenario, Scenario, StepRestCall } from "../apiScenarioTypes";
import { ApiScenarioClientRequest } from "../apiScenarioRunner";
import { Operation, Parameter, SwaggerExample } from "../../swagger/swaggerTypes";
import { unknownApiVersion, xmsLongRunningOperation } from "../../util/constants";
import { VariableEnv } from "../variableEnv";
import { TemplateGenerator } from "../templateGenerator";
import { traverseSwagger } from "../../transform/traverseSwagger";
// import { BodyTransformer } from "../bodyTransformer";
import { ArmApiInfo, ArmUrlParser } from "../armUrlParser";
// import { getJsonPatchDiff } from "../diffUtils";
import { SchemaValidator } from "../../swaggerValidator/schemaValidator";

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
  swaggerFilePaths: string[];
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
  private exampleEntries: ExampleUpdateEntry[] = [];
  private testDefToWrite: Array<{ testDef: RawScenarioDefinition; filePath: string }> = [];
  private operationSearcher: OperationSearcher;
  // private idx: number = 0;
  // Key: OperationId_content, Value: path to example
  private exampleCache = new Map<string, string>();
  private exampleFileList = new Set<string>();
  private lroPollingUrls = new Set<string>();

  public constructor(
    @inject(TYPES.opts) private opts: TestScenarioGeneratorOption,
    private testResourceLoader: ApiScenarioLoader,
    private swaggerLoader: SwaggerLoader,
    private jsonLoader: JsonLoader,
    private exampleTemplateGenerator: TemplateGenerator,
    // private bodyTransformer: BodyTransformer,
    private armUrlParser: ArmUrlParser,
    @inject(TYPES.schemaValidator) private schemaValidator: SchemaValidator
  ) {
    this.operationSearcher = new OperationSearcher((_) => {});
  }
  public static create(opts: TestScenarioGeneratorOption) {
    return inversifyGetInstance(TestScenarioGenerator, opts);
  }

  public async initialize() {
    const transformCtx = getTransformContext(this.jsonLoader, this.schemaValidator, [
      xmsPathsTransformer,
      referenceFieldsTransformer,
      pathRegexTransformer,
    ]);

    for (const swaggerPath of this.opts.swaggerFilePaths ?? []) {
      const swaggerSpec = await this.swaggerLoader.load(swaggerPath);
      applySpecTransformers(swaggerSpec, transformCtx);
      this.operationSearcher.addSpecToCache(swaggerSpec);
      traverseSwagger(swaggerSpec, {
        onOperation: (operation) => {
          const examples = operation["x-ms-examples"] ?? {};
          for (const example of Object.values(examples)) {
            const exampleContent = this.jsonLoader.resolveRefObj(example);
            const cacheKey = this.getExampleCacheKey(operation, exampleContent);
            this.exampleCache.set(cacheKey, example.$ref!);
            // TODO unify path
            this.exampleFileList.add(example.$ref!);
          }
        },
      });
    }
    applyGlobalTransformers(transformCtx);
  }

  public async writeGeneratedFiles() {
    const exampleEntries = this.exampleEntries;
    this.exampleEntries = [];
    const testDefToWrite = this.testDefToWrite;
    this.testDefToWrite = [];

    await this.swaggerLoader.updateSwaggerAndExamples(exampleEntries);
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
      swaggers: [], // TODO
    };

    // this.idx = 0;
    for (const track of requestTracking) {
      const testScenario = await this.generateTestScenario(track, testScenarioFilePath);
      testDef.scenarios.push(testScenario);
    }

    this.testDefToWrite.push({ testDef, filePath: testScenarioFilePath });

    return testDef;
  }

  // private generateIdx() {
  //   return this.idx++;
  // }

  private async generateTestScenario(
    requestTracking: RequestTracking,
    _: string // testDefFilePath
  ): Promise<RawScenario> {
    console.log(`\nGenerating ${requestTracking.description}`);
    const testScenario: RawScenario = {
      scenario: requestTracking.description,
      description: requestTracking.description,
      steps: [],
    };

    const ctx: TestScenarioGenContext = {
      resourceTracking: new Map(),
      resourceNames: new Set(),
      variables: {},
      lastUpdatedResource: "",
    };

    const records = [...requestTracking.requests];
    // let lastOperation: Operation | undefined = undefined;
    while (records.length > 0) {
      // const record = records[0];
      const testStep = await this.generateTestStepRestCall(records, ctx);
      if (testStep === undefined) {
        continue;
      }

      // TODO
      // if (testStep === null) {
      //   const rawStep = await this.generateTestStepRawCall(record, ctx);
      //   testScenario.steps.push(rawStep);
      //   continue;
      // }

      // const { operation } = testStep;
      // if (lastOperation === operation && lastOperation?._method === "get") {
      //   // Skip same get operation
      //   continue;
      // }

      //   if (testStep.resourceUpdate === undefined) {
      //     const example: SwaggerExample = {
      //       parameters: testStep.requestParameters,
      //       responses: {
      //         [testStep.statusCode.toString()]: {
      //           body: testStep.expectedResponse,
      //         },
      //       },
      //     };
      //     const exampleCacheKey = this.getExampleCacheKey(operation, example);
      //     const operationId = operation.operationId!;
      //     const swaggerPath = operation._path._spec._filePath;
      //     let exampleFilePath = this.exampleCache.get(exampleCacheKey);
      //     if (exampleFilePath === undefined) {
      //       let exampleName = `${testStep.step}_Generated`;
      //       exampleFilePath = pathJoin(dirname(swaggerPath), "examples", exampleName + ".json");
      //       if (this.exampleFileList.has(exampleFilePath)) {
      //         exampleName = `${exampleName}_${this.generateIdx()}`;
      //         exampleFilePath = pathJoin(dirname(swaggerPath), "examples", exampleName + ".json");
      //       }

      //       this.exampleEntries.push({
      //         swaggerPath,
      //         operationId,
      //         exampleName,
      //         exampleFilePath,
      //         exampleContent: example,
      //       });
      //       this.exampleCache.set(exampleCacheKey, exampleFilePath);
      //       this.exampleFileList.add(exampleFilePath);
      //     }
      //     testStep.exampleFile = pathRelative(dirname(testDefFilePath), exampleFilePath);
      //     lastOperation = operation;
      //   }

      //   if (testStep.exampleFile !== undefined) {
      //     testScenario.steps.push({
      //       step: testStep.step,
      //       exampleFile: testStep.exampleFile,
      //       statusCode: testStep.statusCode === 200 ? undefined : testStep.statusCode,
      //       resourceUpdate: testStep.resourceUpdate?.length > 0 ? testStep.resourceUpdate : undefined,
      //       variables: testStep.variables,
      //     });
      //   } else if (testStep.resourceName !== undefined && testStep.operationId !== undefined) {
      //     testScenario.steps.push({
      //       step: testStep.step,
      //       resourceName: testStep.resourceName,
      //       operationId: testStep.operationId,
      //       statusCode: testStep.statusCode === 200 ? undefined : testStep.statusCode,
      //       resourceUpdate: testStep.resourceUpdate?.length > 0 ? testStep.resourceUpdate : undefined,
      //       variables: testStep.variables,
      //   });
      // }
    }

    if (Object.keys(ctx.variables).length > 0) {
      testScenario.variables = ctx.variables;
    }

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

  // private async generateTestStepRawCall(
  //   record: SingleRequestTracking,
  //   _ctx: TestScenarioGenContext
  // ): Promise<RawStepRawCall> {
  //   const toString = (body: any) => (typeof body === "object" ? JSON.stringify(body) : body);
  //   const rawCall: RawStepRawCall = {
  //     step: `RawStep_${this.generateIdx()}`,
  //     method: record.method,
  //     rawUrl: record.url,
  //     requestBody: toString(record.body),
  //     requestHeaders: record.headers,
  //     statusCode: record.responseCode === 200 ? undefined : record.responseCode,
  //     expectedResponse: toString(record.responseBody),
  //   };
  //   return rawCall;
  // }

  private async generateTestStepRestCall(
    records: SingleRequestTracking[],
    ctx: TestScenarioGenContext
  ): Promise<StepRestCall | undefined | null> {
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
    // const { operation, requestParameters, pathParamValue } = parseResult;
    // const variables: Scenario["variables"] = {};

    // for (const pathParamKey of Object.keys(pathParamValue)) {
    //   const value = pathParamValue[pathParamKey];
    //   if (unwantedParams.has(pathParamKey) || ctx.variables[pathParamKey] === value) {
    //     continue;
    //   }
    //   if (ctx.variables[pathParamKey] === undefined) {
    //     ctx.variables[pathParamKey] = value;
    //   } else {
    //     variables[pathParamKey] = value;
    //   }
    // }

    // const step = {
    //   step: `${operation.operationId}_${this.generateIdx()}`,
    //   statusCode: record.responseCode,
    //   operation,
    //   operationId: operation.operationId!,
    //   requestParameters,
    //   expectedResponse: record.responseBody,
    //   variables: Object.keys(variables).length > 0 ? variables : undefined,
    // } as StepRestCall;

    // const finalGet = await this.skipLroPoll(records, operation, record, armInfo);
    // if (finalGet !== undefined && operation[xmsLongRunningOperation]) {
    //   step.statusCode = 200;
    //   step.expectedResponse = finalGet.responseBody;
    // } else if (operation[xmsLongRunningOperation]) {
    //   step.statusCode = 200;
    // }

    // if (["PUT"].includes(record.method)) {
    //   const lastStep = ctx.resourceTracking.get(armInfo.resourceUri);
    //   if (lastStep === undefined) {
    //     step.resourceName = this.generateResourceName(armInfo, ctx);
    //     step.step = `Create_${step.resourceName}`;
    //   } else {
    //     if (step.operation !== lastStep.operation) {
    //       throw new Error(
    //         `Two operation detected for one resource path: ${step.operation.operationId} ${step.operation.operationId}`
    //       );
    //     }
    //     step.resourceName = lastStep.resourceName;
    //     step.step = `Update_${step.resourceName}_${this.generateIdx()}`;
    //     const bodyParam = getBodyParam(step.operation, this.jsonLoader);
    //     if (bodyParam !== undefined) {
    //       const { result, inconsistentWarningPaths } = this.bodyTransformer.deepMerge(
    //         step.expectedResponse,
    //         step.requestParameters[bodyParam.name]
    //       );
    //       if (inconsistentWarningPaths.length > 0) {
    //         console.log(
    //           `Warning: following paths in payload are inconsistent in request and response: ${record.url}`
    //         );
    //         for (const p of inconsistentWarningPaths) {
    //           console.log(`\t${p}`);
    //         }
    //       }
    //       eraseUnwantedKeys(result);
    //       const lastStepResult = cloneDeep(lastStep.expectedResponse);
    //       eraseUnwantedKeys(lastStepResult);
    //       const diff = getJsonPatchDiff(lastStepResult, result, { minimizeDiff: false });
    //       step.resourceUpdate = diff;
    //     }
    //   }
    // }

    // if (["PUT", "PATCH", "DELETE"].includes(record.method)) {
    //   if (record.method === "PUT") {
    //     ctx.resourceTracking.set(armInfo.resourceUri, step);
    //   }
    //   if (record.method === "DELETE") {
    //     ctx.resourceTracking.delete(armInfo.resourceUri);
    //   }
    //   // eslint-disable-next-line require-atomic-updates
    //   ctx.lastUpdatedResource = armInfo.resourceUri;
    // }

    // return step;
    return undefined;
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

  private getExampleCacheKey(operation: Operation, exampleContent: SwaggerExample) {
    const env = new VariableEnv();
    env.set("location", { type:"string", value: "__location__"});
    for (const p of operation.parameters ?? []) {
      const param = this.jsonLoader.resolveRefObj(p);
      if (param.in === "path") {
        env.set(param.name, { type: "string", value: `__${param.name}__` });
      }
    }

    const example = cloneDeep(exampleContent);
    eraseUnwantedKeys(example);

    const statusCode = Object.keys(example.responses)[0];

    const step = {
      operation,
      statusCode,
      requestParameters: example.parameters,
      responseExpected: example.responses,
    };
    this.exampleTemplateGenerator.exampleParameterConvention(step, env);

    const exampleStr = jsonStringify({
      requestParameters: step.requestParameters,
      expectedResponse: step.responseExpected,
    });
    return `${operation.operationId}_${exampleStr}`;
  }

  // private generateResourceName(armInfo: ArmApiInfo, ctx: TestScenarioGenContext) {
  //   const resourceName = armInfo.resourceName.split("/").pop();
  //   const resourceType = armInfo.resourceTypes[0].split("/").pop();
  //   // let name = `${resourceName}`;
  //   let name = `${resourceType}_${resourceName}`;
  //   // if (ctx.resourceNames.has(name)) {
  //   //   name = `${resourceType}_${name}`;
  //   // }
  //   if (ctx.resourceNames.has(name)) {
  //     name = `${name}_${this.generateIdx()}`;
  //   }
  //   ctx.resourceNames.add(name);
  //   return name;
  // }

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

// const unwantedParams = new Set(["resourceGroupName", "api-version", "subscriptionId"]);

// const recordToHttpResponse = (record: SingleRequestTracking) => {
//   const response: LROOperationResponse = {
//     parsedHeaders: record.responseHeaders,
//     parsedBody: record.responseBody,
//     headers: new HttpHeaders(record.responseHeaders),
//     request: {
//       method: record.method,
//       url: record.url,
//       query: record.query,
//       headers: new HttpHeaders(record.headers),
//     } as any,
//     status: record.responseCode,
//   };
//   response[LROSYM] = getLROData(response);

//   return response;
// };

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
