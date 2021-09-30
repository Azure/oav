// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import { Operation, Path, SwaggerSpec, LowerHttpMethods } from "../swagger/swaggerTypes";
import { traverseSwagger } from "../transform/traverseSwagger";
import { ScenarioDefinition } from "./apiScenarioTypes";

export interface OperationCoverageResult {
  coveredOperationNumber: number;
  totalOperationNumber: number;
  coverage: number;
  uncoveredOperationIds: string[];
}

export class CoverageCalculator {
  public static calculateOperationCoverage(
    testDef: ScenarioDefinition,
    swaggerSpecs: SwaggerSpec[]
  ): OperationCoverageResult {
    const ret: OperationCoverageResult = {
      coveredOperationNumber: 0,
      totalOperationNumber: 0,
      coverage: 0,
      uncoveredOperationIds: [],
    };

    const allOperationIds = new Set<string>();
    for (const swaggerSpec of swaggerSpecs) {
      traverseSwagger(swaggerSpec, {
        onOperation: (operation: Operation, _path: Path, _method: LowerHttpMethods) => {
          allOperationIds.add(operation.operationId!);
        },
      });
    }
    const coverageOperationIds = new Set<string>();
    for (const step of testDef.prepareSteps) {
      if (step.type === "restCall") {
        coverageOperationIds.add(step.operationId);
      }
    }
    for (const testScenario of testDef.scenarios) {
      for (const step of testScenario.steps) {
        if (step.type === "restCall") {
          coverageOperationIds.add(step.operationId);
        }
      }
    }
    ret.coverage =
      allOperationIds.size === 0 ? 0 : coverageOperationIds.size / allOperationIds.size;
    ret.coveredOperationNumber = coverageOperationIds.size;
    ret.totalOperationNumber = allOperationIds.size;
    const difference = [...allOperationIds].filter((x) => !coverageOperationIds.has(x));
    ret.uncoveredOperationIds = difference;
    return ret;
  }
}
