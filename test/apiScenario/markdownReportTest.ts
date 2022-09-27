// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import {
  generateMarkdownReport,
  generateMarkdownReportHeader,
} from "../../lib/apiScenario/markdownReport";
import { ApiScenarioTestResult } from "../../lib/apiScenario/newmanReportValidator";

describe("markdownReport", () => {
  it("Should generate markdown report", () => {
    const ts = {
      apiScenarioFilePath: "Microsoft.Compute/preview/2020-09-30/test-scenarios/galleries.yaml",
      swaggerFilePaths: ["Microsoft.Compute/preview/2020-09-30/gallery.json"],
      providerNamespace: "Microsoft.Compute",
      apiVersion: "2020-09-30",
      runId: "202106011456-d4udg",
      rootPath: "/home/zhenglai/repos/azure-rest-api-specs/specification/compute/resource-manager",
      environment: "test",
      apiScenarioName: "galleries_1",
      armEndpoint: "https://management.azure.com",
      stepResult: [
        {
          exampleFilePath:
            "Microsoft.Compute/preview/2020-09-30/test-scenarios/examples/CreateOrUpdateASimpleGalleryWithSharingProfile.json",
          operationId: "Galleries_CreateOrUpdate",
          runtimeError: [
            {
              code: "RUNTIME_ERROR_400",
              message:
                "code: BadRequest, message: Subscription 'db5eb68e-73e2-4fa8-b18a-46cd1be4cce5' is not registered with the feature Microsoft.Compute/SIGSharing. Please register the subscription before retrying the call.",
              severity: "Error",
              detail:
                '{\r\n  "error": {\r\n    "code": "BadRequest",\r\n    "message": "Subscription \'db5eb68e-73e2-4fa8-b18a-46cd1be4cce5\' is not registered with the feature Microsoft.Compute/SIGSharing. Please register the subscription before retrying the call."\r\n  }\r\n}',
            },
          ],
          statusCode: 400,
          stepName: "Create or update a simple gallery with sharing profile.",
        },
        {
          exampleFilePath:
            "Microsoft.Compute/preview/2020-09-30/test-scenarios/examples/DeleteAGallery.json",
          operationId: "Galleries_Delete",
          runtimeError: [],
          statusCode: 204,
          stepName: "Delete a gallery.",
        },
      ],
      startTime: "2021-06-01T06:56:46.835Z",
      endTime: "2021-06-01T06:58:07.066Z",
      subscriptionId: "db5eb68e-73e2-4fa8-b18a-46cd1be4cce5",
    } as ApiScenarioTestResult;
    const header = generateMarkdownReportHeader();
    const body = generateMarkdownReport(ts);
    expect(header).toMatchSnapshot("header");
    expect(body).toMatchSnapshot("body");
  });
});
