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
  const diffs = getJsonPatchDiff(payload.liveRequest.body ?? {}, payload.liveResponse.body ?? {}, {
    includeOldValue: true,
    minimizeDiff: false,
  });

  const rest = diffs
    .map((it: any) => {
      const jsonPath: string = it.remove || it.add || it.replace;
      const path = jsonPath.split("/").join("(.*)").concat("$");
      if (it.replace !== undefined) {
        const isReplace =
          operationLoader.attrChecker(
            path,
            providerName!,
            apiversion,
            operationId,
            payload.liveResponse.statusCode,
            true,
            "readOnly"
          ) ||
          operationLoader.attrChecker(
            path,
            providerName!,
            apiversion,
            operationId,
            payload.liveResponse.statusCode,
            true,
            "default"
          ) ||
          operationLoader.attrChecker(
            path,
            providerName!,
            apiversion,
            operationId,
            payload.liveResponse.statusCode,
            true,
            "mutability",
            ["create", "read"]
          );
        if (!isReplace) {
          return buildLiveValidationIssue("ROUNDTRIP_INCONSISTENT_PROPERTY", jsonPath, it);
        }
      } else if (it.add !== undefined) {
        const isReadOnly =
          operationLoader.attrChecker(
            path,
            providerName!,
            apiversion,
            operationId,
            payload.liveResponse.statusCode,
            false,
            "readOnly"
          ) ||
          operationLoader.attrChecker(
            path,
            providerName!,
            apiversion,
            operationId,
            payload.liveResponse.statusCode,
            false,
            "default"
          );
        if (!isReadOnly) {
          return buildLiveValidationIssue("ROUNDTRIP_ADDITIONAL_PROPERTY", jsonPath, it);
        }
      } else if (it.remove !== undefined) {
        const isRemove =
          operationLoader.attrChecker(
            path,
            providerName!,
            apiversion,
            operationId,
            payload.liveResponse.statusCode,
            true,
            "secret"
          ) ||
          operationLoader.attrChecker(
            path,
            providerName!,
            apiversion,
            operationId,
            payload.liveResponse.statusCode,
            true,
            "mutability",
            ["create", "update"]
          );
        if (!isRemove) {
          return buildLiveValidationIssue("ROUNDTRIP_MISSING_PROPERTY", jsonPath, it);
        }
      }
      return undefined;
    })
    .filter((a) => a !== undefined);
  return rest;
}

export function buildLiveValidationIssue(
  errorCode: string,
  path: string,
  it: any
): LiveValidationIssue {
  let severity, message;
  const property = path.split("/").pop();
  switch (errorCode) {
    case "ROUNDTRIP_INCONSISTENT_PROPERTY": {
      severity = roundTripValidationErrors.ROUNDTRIP_INCONSISTENT_PROPERTY.severity;
      message = roundTripValidationErrors.ROUNDTRIP_INCONSISTENT_PROPERTY.message({
        getValue: it.value,
        putValue: it.oldValue,
      });
      break;
    }
    case "ROUNDTRIP_ADDITIONAL_PROPERTY": {
      severity = roundTripValidationErrors.ROUNDTRIP_ADDITIONAL_PROPERTY.severity;
      message = roundTripValidationErrors.ROUNDTRIP_ADDITIONAL_PROPERTY.message({
        property: property,
      });
      break;
    }
    case "ROUNDTRIP_MISSING_PROPERTY": {
      severity = roundTripValidationErrors.ROUNDTRIP_MISSING_PROPERTY.severity;
      message = roundTripValidationErrors.ROUNDTRIP_MISSING_PROPERTY.message({
        property: property,
      });
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
