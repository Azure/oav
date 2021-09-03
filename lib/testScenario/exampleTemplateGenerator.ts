import { escapeRegExp } from "lodash";
import { injectable } from "inversify";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
import { JsonLoader } from "../swagger/jsonLoader";
import { Scenario, ArmTemplate, StepRestCall, StepArmTemplate } from "./apiScenarioTypes";
import { VariableEnv } from "./variableEnv";
import {
  ApiScenarioRunnerClient,
  ApiScenarioClientRequest,
  StepEnv,
  ArmDeploymentTracking,
  ApiScenarioRunner,
} from "./apiScenarioRunner";
import { getBodyParamName } from "./apiScenarioLoader";

@injectable()
export class ExampleTemplateGenerator implements ApiScenarioRunnerClient {
  private baseEnv: VariableEnv;
  private runner: ApiScenarioRunner;

  public constructor(private jsonLoader: JsonLoader) {
    this.baseEnv = new VariableEnv();
    this.runner = new ApiScenarioRunner({
      jsonLoader: this.jsonLoader,
      client: this,
      env: this.baseEnv,
    });
  }

  public async createResourceGroup(): Promise<void> {
    // Pass
  }

  public async deleteResourceGroup(): Promise<void> {
    // Pass
  }

  public async sendExampleRequest(
    _request: ApiScenarioClientRequest,
    step: StepRestCall,
    stepEnv: StepEnv
  ): Promise<void> {
    this.replaceWithParameterConvention(step, stepEnv.env);

    const outputVariables = step.outputVariables;
    if (outputVariables === undefined) {
      return;
    }
    for (const variableName of Object.keys(outputVariables)) {
      stepEnv.env.set(variableName, `$(${variableName})`);
    }
  }

  public async sendArmTemplateDeployment(
    _armTemplate: ArmTemplate,
    _params: { [name: string]: string },
    _armDeployment: ArmDeploymentTracking,
    step: StepArmTemplate,
    _stepEnv: StepEnv
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

      _stepEnv.env.set(outputName, `$(${outputName})`);
    }
  }

  public async generateExampleTemplateForTestScenario(testScenario: Scenario) {
    this.baseEnv.clear();
    for (const requiredVar of testScenario.requiredVariables) {
      this.baseEnv.set(requiredVar, `$(${requiredVar})`);
    }

    await this.runner.executeScenario(testScenario);
  }

  public replaceWithParameterConvention(
    step: Pick<StepRestCall, "requestParameters" | "expectedResponse" | "operation">,
    env: VariableEnv
  ) {
    const toMatch: string[] = [];
    const matchReplace: { [toMatch: string]: string } = {};

    const requestParameters = cloneDeep(step.requestParameters);
    for (const paramName of Object.keys(requestParameters)) {
      if (env.get(paramName) === undefined) {
        continue;
      }

      const paramValue = requestParameters[paramName];
      if (typeof paramValue !== "string") {
        continue;
      }

      const valueLower = paramValue.toLowerCase();
      toMatch.push(valueLower);
      const toReplace = `$(${paramName})`;
      matchReplace[valueLower] = toReplace;
      requestParameters[paramName] = toReplace;
    }
    step.requestParameters = requestParameters;
    const bodyParamName = getBodyParamName(step.operation, this.jsonLoader);
    if (bodyParamName !== undefined) {
      const requestBody = step.requestParameters[bodyParamName];
      replaceAllInObject(requestBody, toMatch, matchReplace);
      if (requestBody.location !== undefined && env.get("location") !== undefined) {
        requestBody.location = "$(location)";
      }
    }

    const expectedResponse = cloneDeep(step.expectedResponse);
    replaceAllInObject(expectedResponse, toMatch, matchReplace);
    step.expectedResponse = expectedResponse;
    if (expectedResponse.body?.location !== undefined && env.get("location") !== undefined) {
      expectedResponse.body.location = "$(location)";
    }
  }
}

const replaceAllInObject = (
  obj: any,
  toMatch: string[],
  matchReplace: { [match: string]: string }
) => {
  if (toMatch.length === 0) {
    return;
  }
  const matchRegExp = new RegExp(toMatch.map(escapeRegExp).join("|"), "gi");

  const replaceString = (input: string) => {
    if (typeof input !== "string") {
      return input;
    }

    const matches = input.matchAll(matchRegExp);
    let result = input;
    let offset = 0;
    for (const match of matches) {
      const matchStr = match[0].toLowerCase();
      const toReplace = matchReplace[matchStr];
      const index = match.index! + offset;
      result = result.substr(0, index) + toReplace + result.substr(index + matchStr.length);

      offset = offset + toReplace.length - matchStr.length;
    }

    return result;
  };

  const traverseObject = (obj: any) => {
    if (obj === null || obj === undefined) {
      return;
    }
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
