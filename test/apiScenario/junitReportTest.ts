// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import { generateJUnitCaseReport } from "../../lib/apiScenario/markdownReport";
import { StepResult } from "../../lib/apiScenario/newmanReportValidator";

describe("junitTestReport", () => {
  it("Should generate junit case report", () => {
    const ts = {
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
      responseDiffResult: [],
      stepValidationResult: [],
      correlationId: "cb309eda-ffb6-41f7-8a5e-42fc2a25aa5e",
      statusCode: 400,
      stepName: "Create or update a simple gallery with sharing profile.",
    } as StepResult;
    const body = generateJUnitCaseReport(ts);
    expect(body).toMatchSnapshot();
  });
});
