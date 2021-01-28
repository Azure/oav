import { join as pathJoin, dirname } from "path";
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
import { unknownApiVersion } from "../../util/constants";
import { LROPoller } from "../lro";
import { LROOperationResponse, LROSYM } from "../lro/models";
import { getLROData } from "../lro/requestUtils";

export type SingleRequestTracking = TestScenarioClientRequest & {
  timeStart?: Date;
  timeEnd?: Date;
  responseBody: any;
  responseCode: number;
  responseHeaders: { [headerName: string]: string };
};

export interface RequestTracking {
  requests: SingleRequestTracking[];
  description: string;
}

export interface TestScenarioGeneratorOption extends TestResourceLoaderOption {}

@injectable()
export class TestScenarioGenerator {
  private exampleEntries: ExampleUpdateEntry[] = [];
  private testDefToWrite: TestDefinitionFile[] = [];
  private operationSearcher: OperationSearcher;

  public constructor(
    @inject(TYPES.opts) private opts: TestScenarioGeneratorOption,
    private testResourceLoader: TestResourceLoader,
    private swaggerLoader: SwaggerLoader,
    private jsonLoader: JsonLoader
  ) {
    this.operationSearcher = new OperationSearcher((msg) => console.log(msg));
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

    for (const track of requestTracking) {
      const testScenario = await this.generateTestScenario(track);
      testDef.testScenarios.push(testScenario);
    }

    this.testDefToWrite.push(testDef);

    return testDef;
  }

  private async generateTestScenario(requestTracking: RequestTracking): Promise<TestScenario> {
    const testScenario: TestScenario = ({
      description: requestTracking.description,
      variables: {},
      steps: [],
    } as Partial<TestScenario>) as TestScenario;

    const records = [...requestTracking.requests];
    let idx = 0;
    while (records.length > 0) {
      const testStep = await this.generateTestStep(records, idx++);
      testScenario.steps.push(testStep);
    }

    return testScenario;
  }

  private async generateTestStep(records: SingleRequestTracking[], idx: number): Promise<TestStep> {
    const record = records.shift()!;

    const info = parseValidationRequest(record.url, record.method, "");
    const { operationMatch } = this.operationSearcher.search(info);
    const { operation } = operationMatch;

    const operationId = operation.operationId!;
    const exampleName = `${operationId}_Generated_${idx}`;
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

    this.exampleEntries.push({
      swaggerPath,
      operationId,
      exampleName,
      exampleFilePath: pathJoin(dirname(swaggerPath), "examples", exampleName + ".json"),
      exampleContent: example,
    });

    await this.skipLroPoll(records, operation, record);

    return ({
      exampleFile: `./examples/${exampleName}.json`,
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

    const poller = new LROPoller({
      initialOperationResult: {
        _response: recordToHttpResponse(initialRecord),
      },
      initialRequestOptions: {
        method: initialRecord.method,
      },
      sendOperation: () => {
        const record = records.shift();
        if (record === undefined) {
          throw new Error("Long running operation not finished in recording");
        }
        return Promise.resolve({
          _response: recordToHttpResponse(record),
        });
      },
    });

    while (!poller.isDone()) {
      await poller.poll();
    }
  }
}

const recordToHttpResponse = (record: SingleRequestTracking) => {
  const response: LROOperationResponse = {
    parsedHeaders: record.responseHeaders,
    headers: new HttpHeaders(record.responseHeaders),
    request: {
      method: record.method,
      url: record.url,
      query: record.query,
      headers: new HttpHeaders(record.headers),
    } as any,
    status: record.responseCode,
  };
  response[LROSYM] = getLROData(response);

  return response;
};

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
