/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as extensionBase from "@microsoft.azure/autorest-extension-base";
// eslint-disable-next-line import/no-internal-modules
import { IAutoRestPluginInitiator } from "@microsoft.azure/autorest-extension-base/dist/lib/extension-base";
// eslint-disable-next-line import/no-internal-modules
import { SourceLocation } from "@microsoft.azure/autorest-extension-base/dist/lib/types";
import { entries } from "@ts-common/string-map";
import * as yaml from "js-yaml";
import { JSONPath } from "jsonpath-plus";
import * as linq from "linq";
import { SwaggerObject } from "yasway";

import { CommonError } from "../util/commonError";
import { log } from "../util/logging";
import { ModelValidator } from "../validators/modelValidator";
import * as specValidator from "../validators/specValidator";

export const extension = new extensionBase.AutoRestExtension();

const openAPIDocUrl = "https://github.com/Azure/oav";

const modelValidatorPluginName = "model-validator";
const modelValidationCategory = "ExampleModelViolation";

class FormattedOutput {
  public constructor(
    public readonly channel: Channel,
    public readonly details: any,
    public readonly code: string[],
    public readonly text: string,
    public readonly source: SourceLocation[]
  ) {}
}

export type Channel = "information" | "warning" | "error" | "debug" | "verbose";

export interface Message {
  readonly channel: Channel;
  readonly text: string;
  readonly details: unknown;
  readonly code: string[];
  readonly source: SourceLocation[];
}

/**
 * Returns a promise with the examples validation of the swagger.
 */
async function analyzeSwagger(
  swaggerFileName: string,
  autoRestApi: extensionBase.Host
): Promise<void> {
  const swaggerFile = await autoRestApi.ReadFile(swaggerFileName);
  const swagger = yaml.safeLoad(swaggerFile);
  const exampleValidationResults = await openApiValidationExample(swagger, swaggerFileName);
  for (const result of exampleValidationResults) {
    autoRestApi.Message({
      Channel: result.channel,
      Text: result.text,
      Details: result.details,
      Key: result.code,
      Source: result.source,
    });
  }
  // console.error(JSON.stringify(exampleValidationResults, null, 2))
}

extension.Add(
  modelValidatorPluginName,
  async (autoRestApi: IAutoRestPluginInitiator): Promise<void> => {
    const swaggerFileNames = await autoRestApi.ListInputs();
    const promises = swaggerFileNames.map(async (swaggerFileName) =>
      analyzeSwagger(swaggerFileName, autoRestApi)
    );
    await Promise.all(promises);
  }
);

export interface Options extends specValidator.Options {
  consoleLogLevel?: unknown;
}

export async function openApiValidationExample(
  swagger: unknown,
  swaggerFileName: string,
  options?: Options
): Promise<Message[]> {
  const formattedResult: FormattedOutput[] = [];
  if (!options) {
    options = {};
  }
  options.consoleLogLevel = "off";
  log.consoleLogLevel = options.consoleLogLevel;
  const specVal = new ModelValidator(swaggerFileName, swagger as SwaggerObject, options);
  // console.error(JSON.stringify(swagger, null, 2))
  await specVal.initialize();
  try {
    await specVal.validateOperations();
    const specValidationResult = specVal.specValidationResult;
    for (const [op, operation] of entries(specValidationResult.operations)) {
      const xmsExamplesNode = operation["x-ms-examples"];
      if (xmsExamplesNode === undefined) {
        throw new Error("xmsExamplesNode is undefined");
      }
      const scenarios = xmsExamplesNode.scenarios;
      for (const [scenario, scenarioItem] of entries(scenarios)) {
        // invalid? meaning that there's an issue found in the validation
        if (scenarioItem.isValid === false) {
          // get path to x-ms-examples in swagger
          const xmsexPath = linq
            .from(
              JSONPath({
                json: swagger as object,
                path: `$.paths[*][?(@.operationId==='${op}')]["x-ms-examples"]`,
                resultType: "path",
              })
            )
            .select((x) => (JSONPath as any).toPathArray(x))
            .firstOrDefault();
          if (!xmsexPath) {
            throw new Error("Model Validator: Path to x-ms-examples not found.");
          }
          // console.error(JSON.stringify(scenarioItem, null, 2));
          let result = new FormattedOutput(
            "verbose",
            { scenarioItem, scenario },
            [modelValidationCategory],
            "Model validator found issue (see details).",
            [{ document: swaggerFileName, Position: { path: xmsexPath } }]
          );
          formattedResult.push(result);

          // request
          const request = scenarioItem.request;
          if (request !== undefined && request.isValid === false) {
            const error = request.error as CommonError;
            const innerErrors = error.innerErrors;
            if (!innerErrors || !innerErrors.length) {
              throw new Error("Model Validator: Unexpected format.");
            }
            for (const innerError of innerErrors) {
              const innerErrorPath = innerError.path as string[];
              const path = convertIndicesFromStringToNumbers(innerErrorPath);
              // console.error(JSON.stringify(error, null, 2))
              const resultDetails = {
                type: "Error",
                code: error.code,
                message: error.message,
                id: error.id,
                validationCategory: modelValidationCategory,
                innerErrors: innerError,
              };
              if (error.code === undefined || error.id === undefined) {
                throw new Error("Invalid error.");
              }
              result = new FormattedOutput(
                "error",
                resultDetails,
                [error.code, error.id, modelValidationCategory],
                innerError.message +
                  ". \nScenario: " +
                  scenario +
                  ". \nDetails: " +
                  JSON.stringify(innerError.errors, null, 2) +
                  "\nMore info: " +
                  openAPIDocUrl +
                  "#" +
                  error.id.toLowerCase() +
                  "-" +
                  error.code.toLowerCase() +
                  "\n",
                [{ document: swaggerFileName, Position: { path } }]
              );
              formattedResult.push(result);
            }
          }

          // responses
          for (const [responseCode, response] of entries(scenarioItem.responses)) {
            if (response.isValid === false) {
              const error = response.error as CommonError;
              const innerErrors = error.innerErrors;
              if (!innerErrors || !innerErrors.length) {
                throw new Error("Model Validator: Unexpected format.");
              }
              for (const innerError of innerErrors) {
                // console.error(JSON.stringify(error, null, 2));
                const resultDetails = {
                  type: "Error",
                  code: error.code,
                  message: error.message,
                  id: error.id,
                  validationCategory: modelValidationCategory,
                  innerErrors: innerError,
                };
                if (error.code === undefined || error.id === undefined) {
                  throw new Error("Invalid error.");
                }
                result = new FormattedOutput(
                  "error",
                  resultDetails,
                  [error.code, error.id, modelValidationCategory],
                  innerError.message +
                    ". \nScenario: " +
                    scenario +
                    ". \nDetails: " +
                    JSON.stringify(innerError.errors, null, 2) +
                    "\nMore info: " +
                    openAPIDocUrl +
                    "#" +
                    error.id.toLowerCase() +
                    "-" +
                    error.code.toLowerCase() +
                    "\n",
                  [
                    {
                      document: swaggerFileName,
                      Position: {
                        path: xmsexPath
                          .slice(0, xmsexPath.length - 1)
                          .concat(["responses", responseCode]),
                      },
                    },
                  ]
                );
                formattedResult.push(result);
              }
            }
          }
        }
      }
    }
    return formattedResult;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    throw err;
  }
}
/**
 * Path comes with indices as strings in "inner errors", so converting those to actual numbers for
 * path to work.
 */
function convertIndicesFromStringToNumbers(path: string[]): Array<string | number> {
  const result: Array<string | number> = path.slice();
  for (let i = 1; i < result.length; ++i) {
    // tslint:disable-next-line: radix
    const num = parseInt(result[i] as string, 10);
    if (!isNaN(num) && result[i - 1] === "parameters") {
      result[i] = num;
    }
  }
  return result;
}
