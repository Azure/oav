import { escapeRegExp } from "lodash";
import { JsonLoader } from "../swagger/jsonLoader";
import { SwaggerExample } from "../swagger/swaggerTypes";
import {
  TestScenario,
  ArmTemplate,
  TestStepExampleFileRestCall,
  TestStepArmTemplateDeployment,
} from "./testResourceTypes";
import { VariableEnv } from "./variableEnv";
import {
  TestScenarioRunnerClient,
  TestScenarioClientRequest,
  TestStepEnv,
  ArmDeploymentTracking,
  TestScenarioRunner,
} from "./testScenarioRunner";

const placeholderToBeDetermined = "__to_be_determined__";

export class ExampleTemplateGenerator implements TestScenarioRunnerClient {
  public constructor(private jsonLoader: JsonLoader) {}

  public async createResourceGroup(): Promise<void> {
    // Pass
  }

  public async deleteResourceGroup(): Promise<void> {
    // Pass
  }

  public async sendExampleRequest(
    _request: TestScenarioClientRequest,
    step: TestStepExampleFileRestCall,
    stepEnv: TestStepEnv
  ): Promise<void> {
    this.replaceWithParameterConvention(step.exampleTemplate, stepEnv.env);
  }

  public async sendArmTemplateDeployment(
    _armTemplate: ArmTemplate,
    _params: { [name: string]: string },
    _armDeployment: ArmDeploymentTracking,
    step: TestStepArmTemplateDeployment,
    stepEnv: TestStepEnv
  ): Promise<void> {
    const outputs = step.armTemplatePayload.outputs;
    if (outputs === undefined) {
      return;
    }

    for (const outputName of Object.keys(outputs)) {
      const outputDef = outputs[outputName];
      if (outputDef.type !== "string") {
        continue;
      }

      stepEnv.env.set(outputName, placeholderToBeDetermined);
    }
  }

  public async generateExampleTemplateForTestScenario(testScenario: TestScenario) {
    const env = new VariableEnv();
    for (const requiredVar of testScenario.requiredVariables) {
      env.set(requiredVar, placeholderToBeDetermined);
    }

    const runner = new TestScenarioRunner({
      jsonLoader: this.jsonLoader,
      client: this,
      env,
    });

    await runner.executeScenario(testScenario);
  }

  private replaceWithParameterConvention(exampleTemplate: SwaggerExample, env: VariableEnv) {
    const toMatch: string[] = [];
    const matchReplace: { [toMatch: string]: string } = {};

    for (const paramName of Object.keys(exampleTemplate.parameters)) {
      if (env.get(paramName) === undefined) {
        continue;
      }

      const paramValue = exampleTemplate.parameters[paramName];
      if (typeof paramValue !== "string") {
        continue;
      }

      toMatch.push(paramValue);
      const toReplace = `$(${paramName})`;
      matchReplace[paramValue] = toReplace;
      exampleTemplate.parameters[paramName] = toReplace;
    }
    replaceAllInObject(exampleTemplate.responses, toMatch, matchReplace);
  }

  // private analysePathTemplate(pathTemplate: string, operation: Operation) {
  //   const sp = pathTemplate.split("/");
  //   if (sp[0] !== "") {
  //     throw new Error(`pathTemplate must starts with "/": ${pathTemplate}`);
  //   }
  //   sp.shift();

  //   const providerIdx = sp.lastIndexOf("providers");
  //   if (providerIdx === -1) {
  //     throw new Error(`pathTemplate without providers is not supported: ${pathTemplate}`);
  //   }

  //   const provider = sp[providerIdx + 1];
  //   if (provider === undefined || this.paramName(provider) !== undefined || provider.length === 0) {
  //     throw new Error(`provider name cannot be detected in path: ${pathTemplate}`);
  //   }

  //   const scopeSlice = sp.slice(0, providerIdx);
  //   const resourceSlice = sp.slice(providerIdx + 2)

  //   const resourceType = resourceSlice.filter((_, idx) => idx === 1 || idx % 2 === 0);
  //   if (resourceSlice.length % 2 === 0) {
  //   }
  // }

  // private paramName(pathSeg: string) {
  //   if (pathSeg.startsWith("{") && pathSeg.endsWith("}")) {
  //     return pathSeg.substr(0, pathSeg.length - 2);
  //   }

  //   return undefined;
  // }
}

const replaceAllInObject = (
  obj: any,
  toMatch: string[],
  matchReplace: { [match: string]: string }
) => {
  const matchRegExp = new RegExp(toMatch.map(escapeRegExp).join("|"), "g");

  const replaceString = (input: string) => {
    if (typeof input !== "string") {
      return input;
    }

    const matches = input.matchAll(matchRegExp);
    let result = input;
    let offset = 0;
    for (const match of matches) {
      const matchStr = match[0];
      const toReplace = matchReplace[matchStr];
      const index = match.index!;
      result =
        result.substr(0, index + offset) +
        toReplace +
        result.substr(index + matchStr.length + offset);

      offset = offset + toReplace.length - matchStr.length;
    }

    return result;
  };

  const traverseObject = (obj: any) => {
    if (Array.isArray(obj)) {
      for (let idx = 0; idx < obj.length; ++idx) {
        if (typeof obj[idx] === "string") {
          obj[idx] = replaceString(obj[idx]);
        } else {
          traverseObject(obj[idx]);
        }
      }
    } else if (typeof obj === "object") {
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === "string") {
          obj[key] = replaceString(obj[key]);
        } else {
          traverseObject(obj[key]);
        }
      }
    }
  };
  traverseObject(obj);
};
