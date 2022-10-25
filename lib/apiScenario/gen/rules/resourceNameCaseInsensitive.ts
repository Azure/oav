import { cloneDeep, toUpper } from "lodash";
import Mocker from "../../../generator/mocker";
import { RawScenarioDefinition } from "../../apiScenarioTypes";
import { ApiTestGeneratorRule, ArmResourceManipulatorInterface } from "../ApiTestRuleBasedGenerator";

function getResourceNameParameter(path: string) {
  const regex = /.+\{(?<name>\w+)\}$/;
  const matches = path.match(regex);
  if (matches) {
    return matches.groups?.name;
  }
  return undefined;
}

export const ResourceNameCaseInsensitive: ApiTestGeneratorRule = {
  name: "ResourceNameCaseInSensitive",
  armRpcCodes: ["RPC-V2-PUT-3"],
  description: "Check if the resource name in the response has same case with resource name in the request.",
  resourceKinds: ["Tracked"],
  appliesTo: ["ARM"],
  useExample: true,
  generator: (resource: ArmResourceManipulatorInterface, base: RawScenarioDefinition) => {
    const getOp = resource.getResourceOperation("Get");
    const resourceName = getResourceNameParameter(getOp?.path);
    const resourceNameVar = resourceName ? cloneDeep(base.variables?.[resourceName]) || {} : {};
    const variables = {} as any;
    if (base.variables && resourceName) {
      // generate a mocked value
      const mocker = new Mocker();
      const randomValue = mocker.mock({ type: "string", minLength: 5, maxLength: 10 }, "value");
      base.variables._mockedRandom = { type: "string", value: randomValue };
      // set the operation variable
      const oldPrefix = (resourceNameVar as any).prefix ||  `${resourceName.toLocaleLowerCase().substring(0, 10)}`;
      (resourceNameVar as any).value = `${toUpper(oldPrefix)}$(_mockedRandom)`;
      delete (resourceNameVar as any).prefix;
      // modify the global variable
      base.variables[resourceName] = { value: `${oldPrefix}$(_mockedRandom)`, type: "string" };
      variables[resourceName] = resourceNameVar;
    }
    const step = { operationId: getOp.operationId ,variables} as any;
    base.scenarios[0].steps.push(step as any);
    return base;
  },
};
