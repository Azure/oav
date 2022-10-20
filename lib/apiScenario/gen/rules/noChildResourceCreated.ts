import { RawScenarioDefinition } from "../../apiScenarioTypes";
import { ApiTestGeneratorRule, ArmResourceManipulatorInterface } from "../ApiTestRuleBasedGenerator";

export const NoChildResourceCreated: ApiTestGeneratorRule = {
  name: "NoChildResourceCreated",
  armRpcCodes: ["RPC-V1-Common-1"],
  description: "Check if put operation will create nested resoruce implicitly.",
  resourceKinds: ["Tracked", "Extension"],
  appliesTo: ["ARM"],
  useExample: true,
  generator: (resource: ArmResourceManipulatorInterface, base: RawScenarioDefinition) => {
    const responses = {} as any;
    const childResources = resource.getChildResource();
    if (childResources.length === 0) {
      return null;
    }
    let hit = false
    for (resource of childResources) {
      if (resource.getListOperations()[0]) {
        const step = { operationId: resource.getListOperations()[0].operationId } as any;
        responses["200"] = {body:{ value: [] }};
        step.responses = responses;
        base.scenarios[0].steps.push(step as any);
        hit = true
      }
    }
    return hit ? base : null
  },
};
