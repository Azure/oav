// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { scenarioReducer, Operation } from "./scenarioReducer"
import { ModelValidationError } from "./modelValidationError"

export function operationReducer(
  acc: ModelValidationError[], [operationId, operation]: [string, Operation]
) {
  const example = operation["x-ms-examples"]
  if (example === undefined) {
    throw new Error("example is undefined")
  }
  const scenarios = example.scenarios
  if (scenarios === undefined) {
    throw new Error("scenarios is undefined")
  }
  return Object
    .keys(scenarios)
    .filter(scenarioName => {
      const scenario = scenarios[scenarioName];
      if (scenario === undefined) {
        throw new Error("scenario is undefined")
      }
      return !scenario.isValid;
    })
    .reduce(
      (scenarioAcc, scenarioName) =>
        scenarioReducer(scenarioAcc, scenarioName, operationId, operation),
      acc
    )
}
