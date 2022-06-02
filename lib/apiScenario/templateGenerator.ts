import { injectable } from "inversify";
import { cloneDeep } from "@azure-tools/openapi-tools-common";
import { JsonLoader } from "../swagger/jsonLoader";
import { StepRestCall, StepArmTemplate, Variable } from "./apiScenarioTypes";
import { getBodyParam } from "./apiScenarioLoader";
import { replaceAllInObject } from "./variableUtils";

@injectable()
export class TemplateGenerator {
  public constructor(private jsonLoader: JsonLoader) {}

  public armTemplateParameterConvention(
    step: Pick<StepArmTemplate, "armTemplatePayload" | "secretVariables">,
    variables: (name: string) => Variable
  ) {
    if (step.armTemplatePayload.parameters === undefined) {
      return;
    }
    for (const paramName of Object.keys(step.armTemplatePayload.parameters)) {
      if (variables(paramName) === undefined) {
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
    step: Pick<StepRestCall, "parameters" | "responses" | "operation">,
    variables: (name: string) => any
  ) {
    const toMatch: string[] = [];
    const matchReplace: { [toMatch: string]: string } = {};

    const parameters = cloneDeep(step.parameters);
    for (const paramName of Object.keys(parameters)) {
      if (variables(paramName) === undefined) {
        continue;
      }

      const paramValue = parameters[paramName];
      if (typeof paramValue !== "string") {
        continue;
      }

      const valueLower = paramValue.toLowerCase();
      toMatch.push(valueLower);
      const toReplace = `$(${paramName})`;
      matchReplace[valueLower] = toReplace;
      parameters[paramName] = toReplace;
    }
    step.parameters = parameters;
    const bodyParam = getBodyParam(step.operation, this.jsonLoader);
    if (bodyParam !== undefined) {
      const requestBody = step.parameters[bodyParam.name];
      replaceAllInObject(requestBody, toMatch, matchReplace);
      if (requestBody.location !== undefined) {
        requestBody.location = "$(location)";
      }
    }

    const statusCode = Object.keys(step.responses).sort()[0];
    const responseBody = cloneDeep(step.responses[statusCode].body);
    replaceAllInObject(responseBody, toMatch, matchReplace);
    step.responses[statusCode].body = responseBody;
    if (responseBody.body?.location !== undefined) {
      responseBody.body.location = "$(location)";
    }
  }
}
