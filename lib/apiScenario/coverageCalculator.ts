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
  coveredOperationIds: string[];
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
      coveredOperationIds: [],
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
      if (step.type === "restCall" && allOperationIds.has(step.operationId)) {
        coverageOperationIds.add(step.operationId);
      }
    }
    for (const testScenario of testDef.scenarios) {
      for (const step of testScenario.steps) {
        if (step.type === "restCall" && allOperationIds.has(step.operationId)) {
          coverageOperationIds.add(step.operationId);
        }
      }
    }
    for (const step of testDef.cleanUpSteps) {
      if (step.type === "restCall" && allOperationIds.has(step.operationId)) {
        coverageOperationIds.add(step.operationId);
      }
    }
    ret.coverage =
      allOperationIds.size === 0 ? 0 : coverageOperationIds.size / allOperationIds.size;
    ret.coveredOperationNumber = coverageOperationIds.size;
    ret.totalOperationNumber = allOperationIds.size;
    ret.coveredOperationIds = [...coverageOperationIds];
    const difference = [...allOperationIds].filter((x) => !coverageOperationIds.has(x));
    ret.uncoveredOperationIds = difference;
    return ret;
  }

  public static calculateOperationCoverageBySpec(
    testDef: ScenarioDefinition,
    swaggerSpecs: SwaggerSpec[]
  ): Map<string, OperationCoverageResult> {
    const ret: Map<string, OperationCoverageResult> = new Map();
    for (const swaggerSpec of swaggerSpecs) {
      const result: OperationCoverageResult = {
        coveredOperationNumber: 0,
        totalOperationNumber: 0,
        coverage: 0,
        coveredOperationIds: [],
        uncoveredOperationIds: [],
      };

      const allOperationIds = new Set<string>();

      traverseSwagger(swaggerSpec, {
        onOperation: (operation: Operation, _path: Path, _method: LowerHttpMethods) => {
          allOperationIds.add(operation.operationId!);
        },
      });
      const coverageOperationIds = new Set<string>();
      for (const step of testDef.prepareSteps) {
        if (step.type === "restCall" && allOperationIds.has(step.operationId)) {
          coverageOperationIds.add(step.operationId);
        }
      }
      for (const testScenario of testDef.scenarios) {
        for (const step of testScenario.steps) {
          if (step.type === "restCall" && allOperationIds.has(step.operationId)) {
            coverageOperationIds.add(step.operationId);
          }
        }
      }
      for (const step of testDef.cleanUpSteps) {
        if (step.type === "restCall" && allOperationIds.has(step.operationId)) {
          coverageOperationIds.add(step.operationId);
        }
      }
      result.coverage =
        allOperationIds.size === 0 ? 0 : coverageOperationIds.size / allOperationIds.size;
      result.coveredOperationNumber = coverageOperationIds.size;
      result.totalOperationNumber = allOperationIds.size;
      result.coveredOperationIds = [...coverageOperationIds];
      const difference = [...allOperationIds].filter((x) => !coverageOperationIds.has(x));
      result.uncoveredOperationIds = difference;

      ret.set(swaggerSpec._filePath, result);
    }
    return ret;
  }
}
