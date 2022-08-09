import { getJsonPatchDiff } from "../apiScenario/diffUtils";

export function diffRequestResponse(request: any, response: any) {
  const delta = getJsonPatchDiff(request, response, {
    includeOldValue: true,
    minimizeDiff: false,
  });
  return delta;
}
