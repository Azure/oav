import { RawScenarioDefinition } from "../../apiScenarioTypes";
import { ApiTestGeneratorRule, ArmResourceManipulatorInterface } from "../ApiTestRuleBasedGenerator";

export const SystemDataExistsInResponse: ApiTestGeneratorRule = {
  name: "SystemDataExistsInResponse",
  armRpcCodes: ["RPC-V1-Common-1"],
  description: "Check if the systemData exists in the response.",
  resourceKinds: ["Tracked","Proxy","Extension"],
  appliesTo: ["ARM"],
  useExample: true,
  generator: (resource: ArmResourceManipulatorInterface, base: RawScenarioDefinition) => {
    const getOp = resource.getResourceOperation("Get");
    const step = { operationId: getOp.operationId } as any;
    const responses = {} as any;

    if (resource.getProperty( "systemData")) {
      responses["200"] = [{ test: "/body/systemData", expression: "to.not.be.undefined" }];
      step.responses = responses
    }
    else {
      return null
    }
    base.scenarios[0].steps.push(step as any);
    return base;
  },
};
