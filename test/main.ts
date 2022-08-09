import { FileLoader } from "../lib/swagger/fileLoader";
import { OperationLoader } from "../lib/armValidator/operationLoader";
import { assert } from "console";
import { DefaultConfig } from "../lib/util/constants";
import { diffRequestResponse } from "../lib/armValidator/roundTripValidator";
import { RequestResponsePair } from "../lib/liveValidation/liveValidator";
import { LiveValidator } from "../lib/liveValidation/liveValidator";
import { ResponseDiffItem } from "../lib/apiScenario/newmanReportValidator";

jest.setTimeout(999999);

describe("Live Validator", () => {
  describe("Initialization", () => {
    it("should initialize with defaults", async () => {
      console.log("Hello world");
      //init operationLoader
      const fileLoader = new FileLoader({

      });
      const ruleMap = new Map<string, string>([
        ["readOnly", "$..[?(@.readOnly)]~"]
      ]);
      const operationLoader = new OperationLoader(fileLoader, ruleMap);

      const swaggerPattern = "/home/adqi/oav/test/liveValidation/swaggers/specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      }); //["/home/adqi/oav/test/liveValidation/swaggers/specification/apimanagement/resource-manager/Microsoft.ApiManagement/preview/2018-01-01/apimapis.json"];
      await operationLoader.init(filePaths);
      assert(operationLoader.cache.size > 0);
      //end of init operationLoader

      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
      };
      const validator = new LiveValidator(options);
      await validator.initialize();
      const cache = validator.operationSearcher.cache;
      assert(cache.size > 0);

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_invalid_VMCreate.json`);
      const { info, error } = validator.getOperationInfo(
        payload.liveRequest,
        "correlationId",
        "activityId"
      );
      if (error !== undefined) {
        console.log(`Error in searching operation ${JSON.stringify(error)}`);
      }
      const operationId = info.operationId;
      const apiversion = info.apiVersion;
      const providerName = info.validationRequest?.providerNamespace;
      console.log(`${operationId}, ${apiversion} ${providerName}`);
      const attrs = operationLoader.getAttrs(providerName!, apiversion, operationId, ["readOnly"]);
      console.log(attrs?.length);
      const diffs = diffRequestResponse(payload.liveRequest.body, payload.liveResponse.body);
      diffs.map((it: any) => {
        const ret: ResponseDiffItem = {
            code: "",
            jsonPath: "",
            severity: "Error",
            message: "",
            detail: "",
        };
        const jsonPath: string = it.remove || it.add || it.replace;
        const path = jsonPath.split("/").join("(.*)");
        console.log(JSON.stringify(it));
        if (it.replace !== undefined) {
          //TODO: x-ms-mutability
          const isReplace = operationLoader.attrChecker(path, providerName!, apiversion, operationId, ["readOnly", "default"]);
          if (!isReplace) {
            ret.code = "ROUNDTRIP_INCONSISTENT_PROPERTY";
            ret.jsonPath = jsonPath;
          }
        } else if (it.add !== undefined) {
          const isReadOnly = operationLoader.attrChecker(path, providerName!, apiversion, operationId, ["readOnly", "default"]);
          if (!isReadOnly) {
            ret.code = "ROUNDTRIP_ADDITIONAL_PROPERTY";
            ret.jsonPath = jsonPath;
          }
        } else if (it.remove !== undefined) {
          //TODO: x-ms-mutability
          const isRemove = operationLoader.attrChecker(path, providerName!, apiversion, operationId, ["secret"]);
          if (!isRemove) {
            ret.code = "ROUNDTRIP_MISSING_PROPERTY";
            ret.jsonPath = jsonPath;
          }
        }
        return ret;
      });
      console.log("Finish validation");
      assert(diffs.length === 3);
      assert(attrs !== undefined);
      //end of roundtrip validation
    });
  });
});
