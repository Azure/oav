import { getJsonPatchDiff } from "../apiScenario/diffUtils";
import { RequestResponsePair } from "../liveValidation/liveValidator";
import { ResponseDiffItem } from "../apiScenario/newmanReportValidator";
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
      const ret: ResponseDiffItem = {
        code: "",
        jsonPath: "",
        severity: "Error",
        message: "",
        detail: "",
      };
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
          ret.code = "ROUNDTRIP_INCONSISTENT_PROPERTY";
          ret.jsonPath = jsonPath;
          return ret;
        }
      } else if (it.add !== undefined) {
        const isReadOnly =
          operationLoader.attrChecker(path, providerName!, apiversion, operationId, "readOnly") ||
          operationLoader.attrChecker(path, providerName!, apiversion, operationId, "default");
        if (!isReadOnly) {
          ret.code = "ROUNDTRIP_ADDITIONAL_PROPERTY";
          ret.jsonPath = jsonPath;
          return ret;
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
          ret.code = "ROUNDTRIP_MISSING_PROPERTY";
          ret.jsonPath = jsonPath;
          return ret;
        }
      }
      return undefined;
    })
    .filter((a) => a !== undefined);
  return rest;
}
