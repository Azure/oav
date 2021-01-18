// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { mapEntries } from "@azure-tools/openapi-tools-common";
import { ModelValidationError } from "./modelValidationError";
import { Scenarios } from "./responseReducer";
import { scenarioReducer } from "./scenarioReducer";

interface OperationResultScenarios {
  readonly operationId: string;
  readonly scenarios: Scenarios;
}

export function operationReducer({
  operationId,
  scenarios,
}: OperationResultScenarios): Iterable<ModelValidationError> {
  const scenariosEntries = mapEntries(scenarios);
  const invalidScenarios = scenariosEntries.filter((entry) => {
    const [, scenario] = entry;
    return !scenario.isValid;
  });
  return invalidScenarios.flatMap((entry) => {
    const [scenarioName, scenario] = entry;
    return scenarioReducer(scenarioName, scenario, operationId);
  });
}
