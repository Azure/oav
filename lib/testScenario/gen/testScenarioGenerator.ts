import { join as pathJoin, relative as pathRelative, dirname } from "path";
import { default as jsonStringify } from "fast-json-stable-stringify";
import { inject, injectable } from "inversify";
import { HttpHeaders } from "@azure/core-http";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
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
import { TestResourceLoader, TestResourceLoaderOption } from "../testResourceLoader";
import { TestDefinitionFile, TestScenario, TestStep } from "../testResourceTypes";
import { TestScenarioClientRequest } from "../testScenarioRunner";
import { Operation, Parameter, SwaggerExample } from "../../swagger/swaggerTypes";
import { unknownApiVersion, xmsLongRunningOperation } from "../../util/constants";
import { VariableEnv } from "../variableEnv";
import { ExampleTemplateGenerator } from "../exampleTemplateGenerator";

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

interface TestStepGenResult {
  operation?: Operation;
  example?: SwaggerExample;
}

@injectable()
export class TestScenarioGenerator {
  private exampleEntries: ExampleUpdateEntry[] = [];
  private testDefToWrite: TestDefinitionFile[] = [];
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
    private exampleTemplateGenerator: ExampleTemplateGenerator
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
    }
    applyGlobalTransformers(transformCtx);
  }

  public async writeGeneratedFiles() {
    const exampleEntries = this.exampleEntries;
    this.exampleEntries = [];
    const testDefToWrite = this.testDefToWrite;
    this.testDefToWrite = [];

    await this.swaggerLoader.updateSwaggerAndExamples(exampleEntries);
    for (const testDef of testDefToWrite) {
      const filePath = testDef._filePath;
      (testDef as any)._filePath = undefined;
      await this.testResourceLoader.writeTestDefinitionFile(filePath, testDef);
    }
  }

  public async generateTestDefinition(
    requestTracking: RequestTracking[],
    testScenarioFilePath: string
  ): Promise<TestDefinitionFile> {
    const testDef: TestDefinitionFile = {
      scope: "ResourceGroup",
      variables: {},
      requiredVariables: [],
      prepareSteps: [],
      testScenarios: [],
      _filePath: testScenarioFilePath,
    };

    this.idx = 0;
    this.exampleCache = new Map<string, string>();
    for (const track of requestTracking) {
      const testScenario = await this.generateTestScenario(track, testScenarioFilePath);
      testDef.testScenarios.push(testScenario);
    }

    this.testDefToWrite.push(testDef);

    return testDef;
  }

  private getIdx() {
    return this.idx++;
  }

  private async generateTestScenario(
    requestTracking: RequestTracking,
    testDefFilePath: string
  ): Promise<TestScenario> {
    console.log(`\nGenerating ${requestTracking.description}`);
    const testScenario: TestScenario = ({
      description: requestTracking.description,
      variables: {},
      steps: [],
    } as Partial<TestScenario>) as TestScenario;

    const records = [...requestTracking.requests];
    let lastOperation: Operation | undefined = undefined;
    while (records.length > 0) {
      const { operation, example } = await this.generateTestStep(records);
      if (lastOperation === operation && lastOperation?._method === "get") {
        // Skip same get operation
        continue;
      }

      if (example !== undefined && operation !== undefined) {
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
        const testStep = ({
          exampleFile: pathRelative(dirname(testDefFilePath), exampleFilePath),
        } as Partial<TestStep>) as TestStep;

        lastOperation = operation;
        testScenario.steps.push(testStep);
      }
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
  ): Promise<TestStepGenResult> {
    if (this.lroPollingUrls.has(record.url) && record.method === "GET") {
      return {};
    }

    const url = new URL(record.url);
    const match = resourceGroupPathRegex.exec(url.pathname);
    if (match !== null) {
      switch (record.method) {
        case "GET":
        case "PUT":
          return {};

        case "DELETE":
          await this.skipLroPoll(
            records,
            {
              [xmsLongRunningOperation]: true,
            } as Operation,
            record
          );
          return {};
      }
    }

    console.info(`Skip UNKNOWN request:\t${record.method}\t${url.pathname}${url.search}`);
    return {};
  }

  private async generateTestStep(records: SingleRequestTracking[]): Promise<TestStepGenResult> {
    const record = records.shift()!;

    const operationMatch = this.searchOperation(record);
    if (operationMatch === undefined) {
      return this.handleUnknownPath(record, records);
    }

    const { operation } = operationMatch;

    if (record.responseCode === 404) {
      console.info(`Skip 404 request:\t${record.method}\t${record.url}`);
      return {};
    }

    const example: SwaggerExample = {
      parameters: { "api-version": unknownApiVersion },
      responses: {},
    };

    example.responses[record.responseCode] = record.responseBody;

    for (const p of operation.parameters ?? []) {
      const param = this.jsonLoader.resolveRefObj(p);
      const paramValue = getParamValue(record, param);
      if (paramValue !== undefined) {
        example.parameters[param.name] = paramValue;
      }
    }

    const pathParamValue = extractPathParamValue(operationMatch);
    example.parameters = {
      ...example.parameters,
      ...pathParamValue,
    };

    await this.skipLroPoll(records, operation, record);

    return {
      operation,
      example,
    };
  }

  private async skipLroPoll(
    records: SingleRequestTracking[],
    operation: Operation,
    initialRecord: SingleRequestTracking
  ) {
    if (!operation["x-ms-long-running-operation"]) {
      return;
    }

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
          continue;
        }
        break;
      }
      // Keep one last polling result in records to build example for GET
      records.unshift(record);
    }

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

    this.exampleTemplateGenerator.replaceWithParameterConvention(example, env);

    const exampleStr = jsonStringify(example);
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
