// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable:no-console max-line-length*/
import * as assert from "assert";
import path from "path";
import {
  PostmanCollectionGenerator,
  PostmanCollectionGeneratorOption,
} from "../../lib/apiScenario/postmanCollectionGenerator";
import { inversifyGetInstance } from "../../lib/inversifyUtils";

const specPath = `${__dirname}/swaggers/specification/appplatform/resource-manager/Microsoft.AppPlatform/preview/2020-11-01-preview/scenarios`;

const testAPI = async (scenariosPath: string, envData: object) => {
  const scenarioFilePath = path.resolve(scenariosPath);
  const fileRoot = path.dirname(scenariosPath);
  const opt: PostmanCollectionGeneratorOption = {
    name: path.basename(scenarioFilePath),
    scenarioDef: scenarioFilePath,
    fileRoot: fileRoot,
    checkUnderFileRoot: false,
    generateCollection: true,
    useJsonParser: false,
    runCollection: true,
    env: envData,
    outputFolder: "generated",
    markdownReportPath: undefined,
    junitReportPath: undefined,
    eraseXmsExamples: false,
    eraseDescription: false,
    enableBlobUploader: false,
    blobConnectionString: process.env.blobConnectionString || "",
    baseUrl: "https://management.azure.com",
    validationLevel: "validate-request-response",
    skipCleanUp: undefined,
    from: undefined,
    to: undefined,
    runId: undefined,
    verbose: false,
  };
  const generator = inversifyGetInstance(PostmanCollectionGenerator, opt);
  await generator.GenerateCollection();
};

describe("API Scenario Loader", () => {
  describe("swagger", () => {
    it("should fail when method don't have operationId", async () => {
      try {
        const scenariosPath = `${specPath}/undefinedOperationId.yaml`;
        await testAPI(scenariosPath, {});
      } catch (err) {
        assert.strictEqual(err.message.substring(0, 38), "OperationId is undefined for operation");
      }
    });

    it("should fail when swagger has duplicated operationId", async () => {
      try {
        const scenariosPath = `${specPath}/duplicatedOperationId.yaml`;
        await testAPI(scenariosPath, {});
      } catch (err) {
        assert.strictEqual(err.message.split(": ")[0], "Duplicated operationId Services_Get");
      }
    });

    it("should fail when xMsExamples don't use $ref property", async () => {
      try {
        const scenariosPath = `${specPath}/xMsExamplesNoRef.yaml`;
        await testAPI(scenariosPath, {});
      } catch (err) {
        assert.strictEqual(err.message, "Example doesn't use $ref: Services_Get");
      }
    });
  });

  describe("API Scenario", () => {
    it("should fail when step has invalid operationId", async () => {
      try {
        const scenariosPath = `${specPath}/stepOperationId.yaml`;
        await testAPI(scenariosPath, {});
      } catch (err) {
        assert.strictEqual(err.message.split(": ")[1].substring(0, 23), "Operation not found for");
      }
    });

    it("should fail when step has invalid file path", async () => {
      try {
        const scenariosPath = `${specPath}/filePath.yaml`;
        await testAPI(scenariosPath, {});
      } catch (err) {
        assert.strictEqual(
          err.message.split(": ")[2].substring(0, 25),
          "no such file or directory"
        );
      }
    });

    it("should fail when missing requiredVariables in env", async () => {
      try {
        const scenariosPath = `${specPath}/basic.yaml`;
        await testAPI(scenariosPath, {});
      } catch (err) {
        assert.strictEqual(
          err.message.substring(0, 44),
          "Missing required variable 'customDomainName'"
        );
      }
    });
  });
});
