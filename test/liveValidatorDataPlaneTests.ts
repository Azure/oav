// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT
import * as path from "path";
import * as fs from "fs";
import { LiveValidator } from "../lib/liveValidation/liveValidator";

const initializeTableValidator = async () => {
  const options = {
    swaggerPathsPattern: ["cosmos-db/data-plane/Microsoft.Tables/preview/2019-02-02/table.json"],
    directory: "./test/liveValidation/swaggers/specification",
  };
  const validator = new LiveValidator(options);
  await validator.initialize();
  return validator;
};

let liveValidatorPromise: Promise<LiveValidator>;
beforeAll(() => {
  liveValidatorPromise = initializeTableValidator();
});

describe("Initialize data-plane swagger", () => {
  it("Initialization", async () => {
    const liveValidator = await liveValidatorPromise;
    expect(liveValidator.operationSearcher.cache.size).toEqual(1);
    expect(Array.from(liveValidator.operationSearcher.cache.keys())).toEqual(["microsoft.tables"]);
  });
});

describe("Validate data-plane swagger", () => {
  it("should return success when validate with x-ms-resource-provider", async () => {
    const liveValidator = await liveValidatorPromise;
    const payloadPathWithProvider = path.resolve(
      "test/liveValidation/payloads/dataplane/deleteCosmosTable_input_withProviderInfo.json"
    );
    const payload = JSON.parse(fs.readFileSync(payloadPathWithProvider, "utf8"));
    const res = await liveValidator.validateLiveRequestResponse(payload);
    expect(res).toEqual({
      requestValidationResult: {
        isSuccessful: true,
        operationInfo: { apiVersion: "2019-02-02", operationId: "Table_Delete" },
        errors: [],
        runtimeException: undefined,
      },
      responseValidationResult: {
        isSuccessful: true,
        operationInfo: { apiVersion: "2019-02-02", operationId: "Table_Delete" },
        errors: [],
        runtimeException: undefined,
      },
    });
  });

  it("should return failed when validate without x-ms-resource-provider", async () => {
    const liveValidator = await liveValidatorPromise;
    const payloadPath = path.resolve(
      "test/liveValidation/payloads/dataplane/deleteCosmosTable_input.json"
    );
    const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
    const res = await liveValidator.validateLiveRequestResponse(payload);
    expect(res.requestValidationResult.isSuccessful).toEqual(undefined);
    expect(res).toMatchInlineSnapshot(
      `
      Object {
        "requestValidationResult": Object {
          "errors": Array [],
          "isSuccessful": undefined,
          "operationInfo": Object {
            "apiVersion": "unknown-api-version",
            "operationId": "unknownOperationId",
          },
          "runtimeException": LiveValidationError {
            "code": "OPERATION_NOT_FOUND_IN_CACHE_WITH_PROVIDER",
            "message": "Could not find provider \\"microsoft.unknown\\" in the cache.",
          },
        },
        "responseValidationResult": Object {
          "errors": Array [],
          "isSuccessful": undefined,
          "operationInfo": Object {
            "apiVersion": "unknown-api-version",
            "operationId": "unknownOperationId",
          },
          "runtimeException": LiveValidationError {
            "code": "OPERATION_NOT_FOUND_IN_CACHE_WITH_PROVIDER",
            "message": "Could not find provider \\"microsoft.unknown\\" in the cache.",
          },
        },
      }
    `
    );
  });
});
