import * as assert from "assert";
import { FileLoader } from "../lib/swagger/fileLoader";
import { OperationLoader } from "../lib/armValidator/operationLoader";
import { DefaultConfig } from "../lib/util/constants";
import { diffRequestResponse } from "../lib/armValidator/roundTripValidator";
import { RequestResponsePair } from "../lib/liveValidation/liveValidator";
import { LiveValidator } from "../lib/liveValidation/liveValidator";

jest.setTimeout(999999);

describe("Live Validator", () => {
  describe("Initialization", () => {
    /*it("should initialize with defaults", async () => {
      //init operationLoader
      const fileLoader = new FileLoader({
      });
      const operationLoader = new OperationLoader(fileLoader);
      const swaggerPattern = "/home/adqi/oav/test/liveValidation/swaggers/specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      await operationLoader.init(filePaths);

      //readOnly
      const readOnlys = operationLoader.getAttrs("microsoft.compute", "2021-11-01", "AvailabilitySets_CreateOrUpdate", "readOnly");
      assert.equal(readOnlys.length, 8);
      assert.equal(readOnlys.includes("parameters/schema/properties/properties/properties/statuses"), true);
      assert.equal(readOnlys.filter((a) => a.includes("parameters")).length, 4);
      //secret
      const secrets = operationLoader.getAttrs("microsoft.compute", "2021-11-01", "VirtualMachines_CreateOrUpdate", "secret");
      assert.equal(secrets.length, 3);
      //default
      const defaults = operationLoader.getAttrs("microsoft.compute", "2021-11-01", "VirtualMachineScaleSetVMs_PowerOff", "default");
      assert.equal(defaults.length, 3);
      //mutability
      let muts = operationLoader.getAttrs("microsoft.compute", "2021-11-01", "AvailabilitySets_CreateOrUpdate", "mutability", ["read", "create"]);
      assert.equal(muts.length, 2);
      muts = operationLoader.getAttrs("microsoft.compute", "2021-11-01", "AvailabilitySets_CreateOrUpdate", "mutability", ["update"]);
      assert.equal(muts.length, 0);
    });*/

    it("readonly properties should not cause error: ROUNDTRIP_INCONSISTENT_PROPERTY", async () => {
      //init operationLoader
      const fileLoader = new FileLoader({
      });
      const operationLoader = new OperationLoader(fileLoader);
      const swaggerPattern = "/home/adqi/oav/test/liveValidation/swaggers/specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      await operationLoader.init(filePaths, true);
      //end of init operationLoader

      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_valid.json`);
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
      const rest = diffRequestResponse(payload, providerName!, apiversion, operationId, operationLoader);
      assert.equal(rest.length, 0);
      //end of roundtrip validation
    });

    it("Faile: ROUNDTRIP_ADDITIONAL_PROPERTY", async () => {
      //init operationLoader
      const fileLoader = new FileLoader({
      });
      const operationLoader = new OperationLoader(fileLoader);
      const swaggerPattern = "/home/adqi/oav/test/liveValidation/swaggers/specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      await operationLoader.init(filePaths, true);
      //end of init operationLoader

      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_invalid.json`);
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
      const rest = diffRequestResponse(payload, providerName!, apiversion, operationId, operationLoader);
      assert.equal(rest.length, 5);
      //end of roundtrip validation
    });
  });
});
