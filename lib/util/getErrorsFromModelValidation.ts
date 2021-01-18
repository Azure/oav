// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as sm from "@azure-tools/openapi-tools-common";

import { ModelValidationError } from "./modelValidationError";
import { operationReducer } from "./operationReducer";
import { OperationResult } from "./scenarioReducer";

export interface ModelValidation {
  operations: sm.MutableStringMap<OperationResult | undefined>;
}

/**
 * From the raw validator engine results process errors to be served.
 */
export function getErrorsFromModelValidation(
  validationResult: ModelValidation
  // tslint:disable-next-line: prettier
): readonly ModelValidationError[] {
  if (!validationResult.operations) {
    return [];
  }

  const entries = sm.mapEntries(validationResult.operations);
  const operationScenarios = entries.filterMap((entry) => {
    const [operationId, operation] = entry;
    const xMsScenarios = operation["x-ms-examples"];
    const scenario = operation["example-in-spec"];
    const scenarios = sm.merge(
      xMsScenarios !== undefined && xMsScenarios.scenarios !== undefined
        ? xMsScenarios.scenarios
        : {},
      scenario !== undefined ? { "example-in-spec": scenario } : {}
    );
    return { operationId, scenarios };
  });
  return operationScenarios.flatMap(operationReducer).toArray();
}
