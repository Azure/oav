// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { scenarioReducer, OperationResult } from "./scenarioReducer"
import { ModelValidationError } from "./modelValidationError"
import { Scenarios } from "./responseReducer"
import * as sm from "@ts-common/string-map"
import * as it from "@ts-common/iterator"

interface OperationResultScenarios {
  readonly operationId: string
  readonly operation: OperationResult
  readonly scenarios: Scenarios
}

export function operationReducer(
  acc: ReadonlyArray<ModelValidationError>,
  {operationId, operation, scenarios }: OperationResultScenarios
): ReadonlyArray<ModelValidationError> {
  const scenariosEntries = sm.entries(scenarios)
  const invalidScenarios = it.filter(scenariosEntries, ([_, scenario]) => !scenario.isValid)
  const result = it.flatMap(
    invalidScenarios,
    ([scenarioName, scenario]) => scenarioReducer(scenarioName, scenario, operationId))
  return [...acc, ...result]
}
