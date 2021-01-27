import { Loader } from "../../swagger/loader";
import { TestResourceLoader, TestResourceLoaderOption } from "../testResourceLoader";
import { TestDefinitionFile, TestScenario } from "../testResourceTypes";
import { TestScenarioClientRequest } from "../testScenarioRunner";

export type SingleRequestTracking = TestScenarioClientRequest & {
  timeStart?: Date;
  timeEnd?: Date;
};

export interface RequestTracking {
  requests: SingleRequestTracking[];
}

export interface TestScenarioGeneratorOptions extends TestResourceLoaderOption {}

class TestScenarioGeneratorInternal extends TestResourceLoader {
  public constructor(protected opts: TestScenarioGeneratorOptions) {
    super(opts);
  }

  public async generateTestScenario(
    requestTracking: RequestTracking,
    testDef?: TestDefinitionFile
  ): Promise<TestDefinitionFile> {
    const step = 


  }
}
