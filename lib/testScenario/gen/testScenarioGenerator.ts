import { join as pathJoin, relative as pathRelative, dirname } from "path";
import { default as jsonStringify } from "fast-json-stable-stringify";
import { inject, injectable } from "inversify";
import { HttpHeaders } from "@azure/core-http";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
import { compare as jsonPatchCompare } from "fast-json-patch";
import { inversifyGetInstance, TYPES } from "../../inversifyUtils";
import { parseValidationRequest } from "../../liveValidation/liveValidator";
import { OperationSearcher } from "../../liveValidation/operationSearcher";
import { JsonLoader } from "../../swagger/jsonLoader";
import { ExampleUpdateEntry, SwaggerLoader } from "../../swagger/swaggerLoader";
import { AjvSchemaValidator } from "../../swaggerValidator/ajvSchemaValidator";
import { getTransformContext } from "../../transform/context";
import { extractPathParamValue, pathRegexTransformer } from "../../transform/pathRegexTransformer";
import { referenceFieldsTransformer } from "../../transform/referenceFieldsTransformer";
import { applyGlobalTransformers, applySpecTransformers } from "../../transform/transformer";
import { xmsPathsTransformer } from "../../transform/xmsPathsTransformer";
import {
  getBodyParamName,
  TestResourceLoader,
  TestResourceLoaderOption,
} from "../testResourceLoader";
import {
  JsonPatchOp,
  RawTestDefinitionFile,
  RawTestScenario,
  TestStepRestCall,
} from "../testResourceTypes";
import { TestScenarioClientRequest } from "../testScenarioRunner";
import { Operation, Parameter, SwaggerExample } from "../../swagger/swaggerTypes";
import { unknownApiVersion, xmsLongRunningOperation } from "../../util/constants";
import { VariableEnv } from "../variableEnv";
import { ExampleTemplateGenerator } from "../exampleTemplateGenerator";
import { traverseSwagger } from "../../transform/traverseSwagger";
import { BodyTransformer } from "../bodyTransformer";

export type SingleRequestTracking = TestScenarioClientRequest & {
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

export interface TestScenarioGeneratorOption extends TestResourceLoaderOption {}

const resourceGroupPathRegex = /^\/subscriptions\/[^\/]+\/resourceGroups\/[^\/]+$/i;

interface TestScenarioGenContext {
  resourceTracking: Map<string, TestStepRestCall>;
}

@injectable()
export class TestScenarioGenerator {
  private exampleEntries: ExampleUpdateEntry[] = [];
  private testDefToWrite: Array<{ testDef: RawTestDefinitionFile; filePath: string }> = [];
  private operationSearcher: OperationSearcher;
  private idx: number = 0;
  // Key: OperationId_content, Value: path to example
  private exampleCache = new Map<string, string>();
  private lroPollingUrls = new Set<string>();

  public constructor(
    @inject(TYPES.opts) private opts: TestScenarioGeneratorOption,
    private testResourceLoader: TestResourceLoader,
    private swaggerLoader: SwaggerLoader,
    private jsonLoader: JsonLoader,
    private exampleTemplateGenerator: ExampleTemplateGenerator,
    private bodyTransformer: BodyTransformer
  ) {
    this.operationSearcher = new OperationSearcher((_) => {});
  }
  public static create(opts: TestScenarioGeneratorOption) {
    return inversifyGetInstance(TestScenarioGenerator, opts);
  }

  public async initialize() {
    const schemaValidator = new AjvSchemaValidator(this.jsonLoader);
    const transformCtx = getTransformContext(this.jsonLoader, schemaValidator, [
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
  ): Promise<RawTestDefinitionFile> {
    const testDef: RawTestDefinitionFile = {
      scope: "ResourceGroup",
      testScenarios: [],
    };

    this.idx = 0;
    this.exampleCache = new Map<string, string>();
    for (const track of requestTracking) {
      const testScenario = await this.generateTestScenario(track, testScenarioFilePath);
      testDef.testScenarios.push(testScenario);
    }

    this.testDefToWrite.push({ testDef, filePath: testScenarioFilePath });

    return testDef;
  }

  private getIdx() {
    return this.idx++;
  }

  private async generateTestScenario(
    requestTracking: RequestTracking,
    testDefFilePath: string
  ): Promise<RawTestScenario> {
    console.log(`\nGenerating ${requestTracking.description}`);
    const testScenario: RawTestScenario = {
      description: requestTracking.description,
      steps: [],
    };

    const ctx: TestScenarioGenContext = {
      resourceTracking: new Map(),
    };

    const records = [...requestTracking.requests];
    let lastOperation: Operation | undefined = undefined;
    while (records.length > 0) {
      const testStep = await this.generateTestStep(records, ctx);
      if (testStep === undefined) {
        continue;
      }

      const { operation } = testStep;
      if (lastOperation === operation && lastOperation?._method === "get") {
        // Skip same get operation
        continue;
      }

      if (testStep.fromStep === undefined) {
        const example: SwaggerExample = {
          parameters: testStep.requestParameters,
          responses: {
            [testStep.statusCode.toString()]: testStep.responseExpected ?? {},
          },
        };
        const exampleCacheKey = this.getExampleCacheKey(operation, example);
        const operationId = operation.operationId!;
        const swaggerPath = operation._path._spec._filePath;
        let exampleFilePath = this.exampleCache.get(exampleCacheKey);
        if (exampleFilePath === undefined) {
          const exampleName = `${operationId}_Generated_${this.getIdx()}`;
          exampleFilePath = pathJoin(dirname(swaggerPath), "examples", exampleName + ".json");
          this.exampleEntries.push({
            swaggerPath,
            operationId,
            exampleName,
            exampleFilePath,
            exampleContent: example,
          });
          this.exampleCache.set(exampleCacheKey, exampleFilePath);
        }
        testStep.exampleFile = pathRelative(dirname(testDefFilePath), exampleFilePath);
        lastOperation = operation;
      }

      testScenario.steps.push({
        step: testStep.step,
        fromStep: testStep.fromStep,
        exampleFile: testStep.exampleFile,
        statusCode: testStep.statusCode === 200 ? undefined : testStep.statusCode,
        operationId: testStep.operationId,
        patchRequest: testStep.patchRequest?.length > 0 ? testStep.patchRequest : undefined,
        patchResponse: testStep.patchResponse?.length > 0 ? testStep.patchResponse : undefined,
      });
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
  ): Promise<TestStepRestCall | undefined> {
    if (this.lroPollingUrls.has(record.url) && record.method === "GET") {
      return undefined;
    }

    const url = new URL(record.url);
    const match = resourceGroupPathRegex.exec(url.pathname);
    if (match !== null) {
      switch (record.method) {
        case "GET":
        case "PUT":
          return undefined;

        case "DELETE":
          await this.skipLroPoll(
            records,
            {
              [xmsLongRunningOperation]: true,
            } as Operation,
            record
          );
          return undefined;
      }
    }

    console.info(`Skip UNKNOWN request:\t${record.method}\t${url.pathname}${url.search}`);
    return undefined;
  }

  private async generateTestStep(
    records: SingleRequestTracking[],
    ctx: TestScenarioGenContext
  ): Promise<TestStepRestCall | undefined> {
    const record = records.shift()!;

    const operationMatch = this.searchOperation(record);
    if (operationMatch === undefined) {
      return this.handleUnknownPath(record, records);
    }

    const { operation } = operationMatch;

    if (record.responseCode === 404) {
      console.info(`Skip 404 request:\t${record.method}\t${record.url}`);
      return undefined;
    }

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

    const step = {
      step: `${operation.operationId}_${this.getIdx()}`,
      statusCode: record.responseCode,
      operation,
      operationId: operation.operationId!,
      requestParameters,
      responseExpected: record.responseBody,
    } as TestStepRestCall;

    let finalGet = await this.skipLroPoll(records, operation, record);
    while (
      ["PUT", "PATCH", "DELETE"].includes(record.method) &&
      records[0]?.url === record.url &&
      records[0].method === "GET" &&
      records[0].responseCode === 200
    ) {
      finalGet = records[0];
      records.shift();
    }

    if (finalGet !== undefined) {
      step.statusCode = 200;
      step.responseExpected = finalGet.responseBody;
    }

    if (["PUT"].includes(record.method)) {
      const lastStep = ctx.resourceTracking.get(record.path);
      if (lastStep !== undefined) {
        step.fromStep = lastStep.step;
        // step.patchRequest = getJsonPatch(lastStep.requestParameters, step.requestParameters);
        const convertedRequest = await this.bodyTransformer.responseBodyToRequest(
          lastStep.responseExpected,
          operation.responses[record.responseCode].schema!
        );
        const bodyParamName = getBodyParamName(step.operation, this.jsonLoader);
        const toPatch = { ...lastStep.requestParameters };
        if (bodyParamName !== undefined) {
          toPatch[bodyParamName] = convertedRequest;
        }
        step.patchRequest = getJsonPatch(toPatch, step.requestParameters);
        // console.log(step.patchRequest);
        // console.log(step.requestParameters);
        step.patchResponse = getJsonPatch(lastStep.responseExpected, step.responseExpected);
      }
      ctx.resourceTracking.set(record.path, step);
    }

    return step;
  }

  private async skipLroPoll(
    records: SingleRequestTracking[],
    operation: Operation,
    initialRecord: SingleRequestTracking
  ) {
    if (!operation["x-ms-long-running-operation"]) {
      return;
    }

    let finalGet: SingleRequestTracking | undefined = undefined;

    const headers = new HttpHeaders(initialRecord.responseHeaders);
    let hasHeader = false;
    for (const headerName of ["Operation-Location", "Azure-AsyncOperation", "Location"]) {
      const headerValue = headers.get(headerName);
      if (headerValue !== undefined && headerValue !== initialRecord.url) {
        this.lroPollingUrls.add(headerValue);
        hasHeader = true;
      }
    }

    while (records.length > 0) {
      const record = records.shift()!;
      if (this.lroPollingUrls.has(record.url) && record.method === "GET") {
        if (record.url === initialRecord.url && record.responseCode === 200) {
          finalGet = record;
        }
        continue;
      }

      records.unshift(record);
      break;
    }

    if (!hasHeader) {
      // User body poller
      let record = records[0];
      while (records.length > 0) {
        record = records.shift()!;
        if (record.url === initialRecord.url && record.method === "GET") {
          if (record.responseCode === 200) {
            finalGet = record;
          }
          continue;
        }
        break;
      }
    }

    if (records[0] === finalGet) {
      records.shift();
    }

    return finalGet;

    // const poller = new LROPoller({
    //   initialOperationResult: {
    //     _response: recordToHttpResponse(initialRecord),
    //   },
    //   initialRequestOptions: {
    //     method: initialRecord.method,
    //   },
    //   sendOperation: (request) => {
    //     const record = records.shift();
    //     if (record === undefined) {
    //       throw new Error("Long running operation not finished in recording");
    //     }
    //     this.lroPollingUrls.add(record.path);
    //     return Promise.resolve({
    //       _response: recordToHttpResponse(record),
    //     });
    //   },
    // });

    // while (!poller.isDone()) {
    //   await poller.poll();
    // }
  }

  private getExampleCacheKey(operation: Operation, exampleContent: SwaggerExample) {
    const env = new VariableEnv();
    for (const p of operation.parameters ?? []) {
      const param = this.jsonLoader.resolveRefObj(p);
      if (param.in === "path") {
        env.set(param.name, `__${param.name}__`);
      }
    }

    const example = cloneDeep(exampleContent);

    const step = {
      operation,
      requestParameters: example.parameters,
      responseExpected: Object.values(example.responses)[0],
    };
    this.exampleTemplateGenerator.replaceWithParameterConvention(step, env);

    const exampleStr = jsonStringify({
      requestParameters: step.requestParameters,
      responseExpected: step.responseExpected,
    });
    return `${operation.operationId}_${exampleStr}`;
  }
}

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

const getJsonPatch = (from: any, to: any): JsonPatchOp[] => {
  const ops = jsonPatchCompare(from, to);
  return ops.map(
    (op): JsonPatchOp => {
      switch (op.op) {
        case "add":
          return { add: op.path, value: op.value };
        case "copy":
          return { copy: op.from, path: op.path };
        case "move":
          return { move: op.from, path: op.path };
        case "remove":
          return { remove: op.path };
        case "replace":
          return { replace: op.path, value: op.value };
        default:
          throw new Error(`Internal error`);
      }
    }
  );
};
