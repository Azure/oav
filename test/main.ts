import { FileLoader } from "../lib/swagger/fileLoader";
import { OperationLoader } from "../lib/armValidator/operationLoader";
import { assert } from "console";
import { DefaultConfig } from "../lib/util/constants";
import { diffRequestResponse } from "../lib/armValidator/roundTripValidator";
import { RequestResponsePair } from "../lib/liveValidation/liveValidator";
import { LiveValidator } from "../lib/liveValidation/liveValidator";

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
      const diffs = diffRequestResponse(payload.liveRequest.body, payload.liveResponse.body);
      for (const diff of diffs) {
        console.log(JSON.stringify(diff));
      }
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
      const attrs = operationLoader.getAttrs(providerName!, apiversion, operationId);
      const testattrs = operationLoader.getAttrs("test", apiversion, operationId);
      assert(testattrs === undefined);
      console.log(attrs?.size);
      assert(diffs.length === 3);
      assert(attrs !== undefined);
      //end of roundtrip validation
    });
  });
});
