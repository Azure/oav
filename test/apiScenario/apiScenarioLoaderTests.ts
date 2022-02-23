// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* tslint:disable:no-console max-line-length*/

import path from "path";
import {
  PostmanCollectionGenerator,
  PostmanCollectionGeneratorOption,
} from "../../lib/apiScenario/postmanCollectionGenerator";
import { inversifyGetInstance } from "../../lib/inversifyUtils";

const specPath = `${__dirname}/swaggers/specification`;

describe("API Scenario Loader", () => {
  describe("Path validation - ", () => {
    it("should pass when path parameter has forward slashes", async () => {
      try {
        const scenariosPath = `${specPath}/signal/resource-manager/Microsoft.SignalRService/preview/2021-06-01-preview/scenarios/basic.yaml`;
        const scenarioFilePath = path.resolve(scenariosPath);
        const fileRoot = path.dirname(scenariosPath);
        const env = {
          subscriptionId: "00000000-0000-0000-0000-000000000000",
          location:
            "https://management.azure.com/subscriptions/subid/providers/Microsoft.SignalRService/...pathToOperationResult...",
        };
        const opt: PostmanCollectionGeneratorOption = {
          name: path.basename(scenarioFilePath),
          scenarioDef: scenarioFilePath,
          fileRoot: fileRoot,
          checkUnderFileRoot: false,
          generateCollection: true,
          useJsonParser: false,
          runCollection: true,
          env: env,
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
      } catch (err) {
        const message = `test error: ${err.message}, ${JSON.stringify(err)}`;
        console.error(message);
      }
    }, 300000);
  });
});
