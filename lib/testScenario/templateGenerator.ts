import { escapeRegExp } from "lodash";
import { injectable } from "inversify";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
import { JsonLoader } from "../swagger/jsonLoader";
import { ArmTemplate, StepRestCall, StepArmTemplate } from "./apiScenarioTypes";
import { VariableEnv } from "./variableEnv";
import {
  ApiScenarioRunnerClient,
  ApiScenarioClientRequest,
  StepEnv,
  ArmDeploymentTracking,
} from "./apiScenarioRunner";
import { getBodyParamName } from "./apiScenarioLoader";

@injectable()
export class TemplateGenerator implements ApiScenarioRunnerClient {
  public constructor(private jsonLoader: JsonLoader) {}

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
    this.exampleParameterConvention(step, stepEnv.env);

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
    _armDeployment: ArmDeploymentTracking,
    step: StepArmTemplate,
    stepEnv: StepEnv
  ): Promise<void> {
    this.armTemplateParameterConvention(step, stepEnv.env);

    const outputs = step.armTemplatePayload.outputs;
    if (outputs === undefined) {
      return;
    }

    for (const outputName of Object.keys(outputs)) {
      const outputDef = outputs[outputName];
      if (outputDef.type !== "string") {
        continue;
      }

      stepEnv.env.set(outputName, `$(${outputName})`);
    }
  }

  public armTemplateParameterConvention(
    step: Pick<StepArmTemplate, "armTemplatePayload" | "secretVariables">,
    env: VariableEnv
  ) {
    if (step.armTemplatePayload.parameters === undefined) {
      return;
    }
    for (const paramName of Object.keys(step.armTemplatePayload.parameters)) {
      if (env.get(paramName) === undefined) {
        continue;
      }

      const param = step.armTemplatePayload.parameters[paramName];
      if (param.type !== "string" && param.type !== "securestring") {
        continue;
      }

      param.defaultValue = `$(${paramName})`;

      if (param.type === "securestring" && !step.secretVariables.includes(paramName)) {
        step.secretVariables.push(paramName);
      }
    }
  }

  public exampleParameterConvention(
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
