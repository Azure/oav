import { getJsonPatchDiff } from "../apiScenario/diffUtils";
import { RequestResponsePair, LiveValidationIssue } from "../liveValidation/liveValidator";
import { roundTripValidationErrors } from "../util/errorDefinitions";
import { OperationLoader } from "./operationLoader";

export function diffRequestResponse(
  payload: RequestResponsePair,
  providerName: string,
  apiversion: string,
  operationId: string,
  operationLoader: OperationLoader
) {
  const diffs = getJsonPatchDiff(payload.liveRequest.body, payload.liveResponse.body, {
    includeOldValue: true,
    minimizeDiff: false,
  });

  const rest = diffs
    .map((it: any) => {
      const jsonPath: string = it.remove || it.add || it.replace;
      const path = jsonPath.split("/").join("(.*)").concat("$");
      //console.log(`jsonPath regex pattern: ${JSON.stringify(it)}`);
      if (it.replace !== undefined) {
        //TODO: x-ms-mutability
        const isReplace =
          operationLoader.attrChecker(path, providerName!, apiversion, operationId, "readOnly") ||
          operationLoader.attrChecker(path, providerName!, apiversion, operationId, "default") ||
          operationLoader.attrChecker(path, providerName!, apiversion, operationId, "mutability", [
            "create",
            "read",
          ]);
        if (!isReplace) {
          return buildLiveValidationIssue("ROUNDTRIP_INCONSISTENT_PROPERTY", jsonPath);
        }
      } else if (it.add !== undefined) {
        const isReadOnly =
          operationLoader.attrChecker(path, providerName!, apiversion, operationId, "readOnly") ||
          operationLoader.attrChecker(path, providerName!, apiversion, operationId, "default");
        if (!isReadOnly) {
          return buildLiveValidationIssue("ROUNDTRIP_ADDITIONAL_PROPERTY", jsonPath);
        }
      } else if (it.remove !== undefined) {
        //TODO: x-ms-mutability
        const isRemove =
          operationLoader.attrChecker(path, providerName!, apiversion, operationId, "secret") ||
          operationLoader.attrChecker(path, providerName!, apiversion, operationId, "mutability", [
            "create",
            "update",
          ]);
        if (!isRemove) {
          return buildLiveValidationIssue("ROUNDTRIP_MISSING_PROPERTY", jsonPath);
        }
      }
      return undefined;
    })
    .filter((a) => a !== undefined);
  return rest;
}

export function buildLiveValidationIssue(errorCode: string, path: string): LiveValidationIssue {
  let severity, message;
  switch (errorCode) {
    case "ROUNDTRIP_INCONSISTENT_PROPERTY": {
      severity = roundTripValidationErrors.ROUNDTRIP_INCONSISTENT_PROPERTY.severity;
      message = roundTripValidationErrors.ROUNDTRIP_INCONSISTENT_PROPERTY.message({});
      break;
    }
    case "ROUNDTRIP_ADDITIONAL_PROPERTY": {
      severity = roundTripValidationErrors.ROUNDTRIP_ADDITIONAL_PROPERTY.severity;
      message = roundTripValidationErrors.ROUNDTRIP_ADDITIONAL_PROPERTY.message({});
      break;
    }
    case "ROUNDTRIP_MISSING_PROPERTY": {
      severity = roundTripValidationErrors.ROUNDTRIP_MISSING_PROPERTY.severity;
      message = roundTripValidationErrors.ROUNDTRIP_MISSING_PROPERTY.message({});
      break;
    }
    default: {
      break;
    }
  }
  const ret = {
    code: errorCode,
    pathsInPayload: [path],
    severity: severity,
    message: message,
    jsonPathsInPayload: [],
    schemaPath: "",
    source: {
      url: "",
      position: {
        column: 0,
        line: 0,
      },
    },
  };

  return ret as LiveValidationIssue;
}
