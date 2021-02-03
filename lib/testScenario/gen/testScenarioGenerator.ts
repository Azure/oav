import { join as pathJoin, relative as pathRelative, dirname } from "path";
import { default as jsonStringify } from "fast-json-stable-stringify";
import { inject, injectable } from "inversify";
import { HttpHeaders } from "@azure/core-http";
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
    private jsonLoader: JsonLoader
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
    testScenarioFilePath: string
  ): Promise<TestScenario> {
    console.log(`\nGenerating ${requestTracking.description}`);
    const testScenario: TestScenario = ({
      description: requestTracking.description,
      variables: {},
      steps: [],
    } as Partial<TestScenario>) as TestScenario;

    const records = [...requestTracking.requests];
    while (records.length > 0) {
      const testStep = await this.generateTestStep(records, testScenarioFilePath);
      if (testStep !== undefined) {
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
  ): Promise<TestStep | undefined> {
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
    testDefFilePath: string
  ): Promise<TestStep | undefined> {
    const record = records.shift()!;

    const operationMatch = this.searchOperation(record);
    if (operationMatch === undefined) {
      return this.handleUnknownPath(record, records);
    }

    const { operation } = operationMatch;

    const operationId = operation.operationId!;
    const swaggerPath = operation._path._spec._filePath;

    const example: SwaggerExample = {
      parameters: { "api-version": unknownApiVersion },
      responses: {},
    };

    example.responses[record.responseCode] = record.body;

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

    const exampleCacheKey = this.getExampleCacheKey(operationId, example);
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

    await this.skipLroPoll(records, operation, record);

    return ({
      exampleFile: pathRelative(dirname(testDefFilePath), exampleFilePath),
    } as Partial<TestStep>) as TestStep;
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
    for (const headerName of ["Operation-Location", "Azure-AsyncOperation", "Location"]) {
      const headerValue = headers.get(headerName);
      if (headerValue !== undefined) {
        this.lroPollingUrls.add(headerValue);
      }
    }

    while (records.length > 0) {
      const record = records.shift()!;
      if (this.lroPollingUrls.has(record.url) && record.method === "GET") {
        continue;
      }

      records.unshift(record);
      return;
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

  private getExampleCacheKey(operationId: string, exampleContent: SwaggerExample) {
    const example: SwaggerExample = {
      ...exampleContent,
      parameters: {
        ...exampleContent.parameters,
      },
    };
    if (example.parameters.resourceGroupName !== undefined) {
      example.parameters.resourceGroupName = "rg";
    }
    if (example.parameters.subscriptionId !== undefined) {
      example.parameters.resourceGroupName = "subsId";
    }

    const exampleStr = jsonStringify(exampleContent);
    return `${operationId}_${exampleStr}`;
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
