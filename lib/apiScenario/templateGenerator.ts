import { escapeRegExp } from "lodash";
import { injectable } from "inversify";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
import { JsonLoader } from "../swagger/jsonLoader";
import { StepRestCall, StepArmTemplate, Variable } from "./apiScenarioTypes";
import { getBodyParam } from "./apiScenarioLoader";

@injectable()
export class TemplateGenerator {
  public constructor(private jsonLoader: JsonLoader) {}

  public armTemplateParameterConvention(
    step: Pick<StepArmTemplate, "armTemplatePayload" | "secretVariables">,
    variables: { [variableName: string]: Variable }
  ) {
    if (step.armTemplatePayload.parameters === undefined) {
      return;
    }
    for (const paramName of Object.keys(step.armTemplatePayload.parameters)) {
      if (variables[paramName] === undefined) {
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
    step: Pick<StepRestCall, "requestParameters" | "responseExpected" | "operation">,
    variables: (name: string) => Variable
  ) {
    const toMatch: string[] = [];
    const matchReplace: { [toMatch: string]: string } = {};

    const requestParameters = cloneDeep(step.requestParameters);
    for (const paramName of Object.keys(requestParameters)) {
      if (variables(paramName) === undefined) {
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
    const bodyParam = getBodyParam(step.operation, this.jsonLoader);
    if (bodyParam !== undefined) {
      const requestBody = step.requestParameters[bodyParam.name];
      replaceAllInObject(requestBody, toMatch, matchReplace);
      if (requestBody.location !== undefined) {
        requestBody.location = "$(location)";
      }
    }

    const statusCode = Object.keys(step.responseExpected).sort()[0];
    const expectedResponseBody = cloneDeep(step.responseExpected[statusCode].body);
    replaceAllInObject(expectedResponseBody, toMatch, matchReplace);
    step.responseExpected[statusCode].body = expectedResponseBody;
    if (expectedResponseBody.body?.location !== undefined) {
      expectedResponseBody.body.location = "$(location)";
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
