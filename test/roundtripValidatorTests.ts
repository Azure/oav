import * as assert from "assert";
import { DefaultConfig } from "../lib/util/constants";
import { RequestResponsePair } from "../lib/liveValidation/liveValidator";
import { LiveValidator } from "../lib/liveValidation/liveValidator";

jest.setTimeout(999999);

describe("Live Validator", () => {
  describe("Initialization", () => {
    it("OperationLoader should not be initialized", async () => {
      console.log("OperationLoader should not be initialized");
      const swaggerPattern = "specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
        swaggerPaths: filePaths,
        loadValidatorInInitialize: true,
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      assert.equal(validator.operationLoader, undefined);
    });

    /*it("OperationLoader should be completely initialized", async () => {
      console.log("OperationLoader should be completely initialized");
      const swaggerPattern = "specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        enableRoundTripLazyBuild: false
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      assert.strictEqual(true, validator.operationLoader.cache.size > 0);
      const readOnlys = validator.operationLoader.getAttrs("microsoft.compute", "2021-11-01", "AvailabilitySets_CreateOrUpdate", "readOnly");
      assert.equal(readOnlys.length, 8);
      assert.equal(readOnlys.includes("parameters/schema/properties/properties/properties/statuses"), true);
      assert.equal(readOnlys.filter((a) => a.includes("parameters")).length, 4);
        
    });

    it("OperationLoader should be initialized only with spec", async () => {
      console.log("OperationLoader should be initialized only with spec");
      const swaggerPattern = "specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        enableRoundTripLazyBuild: true
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      assert.strictEqual(true, validator.operationLoader.cache.size > 0);
      let op = validator.operationLoader.cache.get("microsoft.compute")?.get("2021-11-01")?.get("AvailabilitySets_CreateOrUpdate");
      assert.equal(op, undefined);
      const readOnlys = validator.operationLoader.getAttrs("microsoft.compute", "2021-11-01", "AvailabilitySets_CreateOrUpdate", "readOnly");
      assert.equal(readOnlys.length, 8);
      const spec = validator.operationLoader.cache.get("microsoft.compute")?.get("2021-11-01")?.get("spec");
      assert.notStrictEqual(spec, undefined);
      op = validator.operationLoader.cache.get("microsoft.compute")?.get("2021-11-01")?.get("AvailabilitySets_CreateOrUpdate");
      assert.notStrictEqual(op, undefined);
    });

    it("readonly properties should not cause error", async () => {
      console.log("readonly properties should not cause error");
      const swaggerPattern = "specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        enableRoundTripLazyBuild: true
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      assert.strictEqual(true, validator.operationLoader.cache.size > 0);
      const readOnlys = validator.operationLoader.getAttrs("microsoft.compute", "2021-11-01", "AvailabilitySets_CreateOrUpdate", "readOnly");
      assert.equal(readOnlys.length, 8);
      assert.equal(readOnlys.includes("parameters/schema/properties/properties/properties/statuses"), true);
      assert.equal(readOnlys.filter((a) => a.includes("parameters")).length, 4);

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_valid.json`);
      const rest = await validator.validateRoundTrip(payload);
      assert.equal(rest.errors, 0);
      assert.equal(rest.isSuccessful, true);
      //end of roundtrip validation
    });

    it("Round trip validation fail", async () => {
      console.log("Round trip validation fail");
      const swaggerPattern = "specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        enableRoundTripLazyBuild: true
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      assert.strictEqual(true, validator.operationLoader.cache.size > 0);
      const readOnlys = validator.operationLoader.getAttrs("microsoft.compute", "2021-11-01", "AvailabilitySets_CreateOrUpdate", "readOnly");
      assert.equal(readOnlys.length, 8);
      assert.equal(readOnlys.includes("parameters/schema/properties/properties/properties/statuses"), true);
      assert.equal(readOnlys.filter((a) => a.includes("parameters")).length, 4);

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_invalid.json`);
      const rest = await validator.validateRoundTrip(payload);
      assert.equal(rest.errors.length, 5);
      for (const re of rest.errors) {
        if (re.pathsInPayload[0].includes("location")) {
          assert.equal(re.code, "ROUNDTRIP_INCONSISTENT_PROPERTY");
        } else if (re.pathsInPayload[0].includes("createOption")) {
          assert.equal(re.code, "ROUNDTRIP_MISSING_PROPERTY");
        } else if (re.pathsInPayload[0].includes("caching")) {
          assert.equal(re.code, "ROUNDTRIP_ADDITIONAL_PROPERTY");
        } else if (re.pathsInPayload[0].includes("offer")) {
          assert.equal(re.code, "ROUNDTRIP_MISSING_PROPERTY");
        } else if (re.pathsInPayload[0].includes("computerName")) {
          assert.equal(re.code, "ROUNDTRIP_MISSING_PROPERTY");
        }
      }
      assert.equal(rest.isSuccessful, false);
      //end of roundtrip validation
    });*/

    it("Round trip multiple payload validation fail", async () => {
      console.log("Round trip multiple payload validation fail");
      const swaggerPattern = "specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        enableRoundTripLazyBuild: true,
        loadValidatorInInitialize: true,
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      assert.strictEqual(true, validator.operationLoader.cache.size > 0);
      const readOnlys = validator.operationLoader.getAttrs("microsoft.compute", "2021-11-01", "AvailabilitySets_CreateOrUpdate", "readOnly");
      assert.equal(readOnlys.length, 8);
      assert.equal(readOnlys.includes("parameters/schema/properties/properties/properties/statuses"), true);
      assert.equal(readOnlys.filter((a) => a.includes("parameters")).length, 4);

      //roundtrip validation
      let payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_invalid.json`);
      console.log("need init first");
      let rest = await validator.validateRoundTrip(payload);
      assert.equal(rest.isSuccessful, false);
      console.log("need no init");
      rest = await validator.validateRoundTrip(payload);
      rest = await validator.validateRoundTrip(payload);
      rest = await validator.validateRoundTrip(payload);
      payload = require(`${__dirname}/liveValidation/payloads/roundTrip_test.json`);
      console.log("need init first");
      rest = await validator.validateRoundTrip(payload);
      console.log("need no init");
      rest = await validator.validateRoundTrip(payload);
      rest = await validator.validateRoundTrip(payload);
      assert.equal(rest.isSuccessful, true);
      //end of roundtrip validation
    });

  });
});
