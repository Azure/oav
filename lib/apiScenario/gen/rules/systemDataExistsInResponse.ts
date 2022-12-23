import { RawScenario, RawStep } from "../../apiScenarioTypes";
import { ApiTestGeneratorRule, ResourceManipulatorInterface } from "../ApiTestRuleBasedGenerator";

export const SystemDataExistsInResponse: ApiTestGeneratorRule = {
  name: "SystemDataExistsInResponse",
  armRpcCodes: ["RPC-SystemData-V1-01"],
  description: "Check if the systemData exists in the response.",
  resourceKinds: ["Tracked","Proxy","Extension"],
  appliesTo: ["ARM"],
  useExample: true,
  generator: (resource: ResourceManipulatorInterface, base: RawScenario) => {
    const getOp = resource.getResourceOperation("Get");
    const step:RawStep = { operationId: getOp.operationId };
    const responses = {} as any;

    if (resource.getProperty( "systemData")) {
      responses["200"] = [{ test: "/body/systemData", expression: "to.not.be.undefined" }];
      step.responses = responses
    }
    else {
      return null
    }
    base.steps.push(step);
    return base;
  },
};
