import * as assert from "assert";
import { DefaultConfig } from "../lib/util/constants";
import { RequestResponsePair } from "../lib/liveValidation/liveValidator";
import { LiveValidator } from "../lib/liveValidation/liveValidator";

jest.setTimeout(999999);

describe("Live Validator", () => {
  describe("Initialization", () => {
    it("OperationLoader should be completely initialized", async () => {
      console.log("OperationLoader should be completely initialized");
      const swaggerPattern = "specification/compute/resource-manager/Microsoft.Compute/stable/2021-11-01/runCommands.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "compute/resource-manager/Microsoft.Compute/stable/2021-11-01/runCommands.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      assert.equal(validator.withRefSibingsOperationSearcher.cache.size, 1);
    });

    it("OperationLoader should be completely initialized", async () => {
      console.log("OperationLoader should be completely initialized");
      const swaggerPattern = "specification/**/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "**/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      assert.equal(validator.withRefSibingsOperationSearcher.cache.size, 19);
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
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_valid.json`);
      const rest = await validator.validateRoundTrip(payload);
      assert.equal(rest.errors, 0);
      assert.equal(rest.isSuccessful, true);
      expect(rest).toMatchSnapshot();
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
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_invalid.json`);
      const rest = await validator.validateRoundTrip(payload);
      expect(rest).toMatchSnapshot();
      assert.equal(rest.errors.length, 7);
      assert.equal(rest.isSuccessful, false);
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
      //end of roundtrip validation
    });

    it("Round trip validation of circular spec", async () => {
      console.log("Round trip validation fail");
      const swaggerPattern = "specification/containerservice/resource-manager/Microsoft.ContainerService/stable/2019-08-01/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "containerservice/resource-manager/Microsoft.ContainerService/stable/2019-08-01/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundtrip_failure_circularspec.json`);
      const rest = await validator.validateRoundTrip(payload);
      assert.equal(rest.errors.length, 3);
      assert.equal(rest.isSuccessful, false);
      for (const re of rest.errors) {
        if (re.pathsInPayload[0].includes("location")) {
          assert.equal(re.code, "ROUNDTRIP_ADDITIONAL_PROPERTY");
        } else if (re.pathsInPayload[0].includes("properties")) {
          assert.equal(re.code, "ROUNDTRIP_ADDITIONAL_PROPERTY");
        } else if (re.pathsInPayload[0].includes("identity")) {
          assert.equal(re.code, "ROUNDTRIP_ADDITIONAL_PROPERTY");
        }
      }
      //end of roundtrip validation
    });

    it("Round trip validation of circular spec cognitiveService", async () => {
      console.log("Round trip validation fail");
      const swaggerPattern = "specification/cognitiveservices/data-plane/Language/preview/2022-10-01-preview/*.json";
      const glob = require("glob");
      const filePaths: string[] = glob.sync(swaggerPattern, {
        ignore: DefaultConfig.ExcludedExamplesAndCommonFiles,
        nodir: true,
      });
      const options = {
        directory: "./test/liveValidation/swaggers/specification",
        swaggerPathsPattern: [
          "cognitiveservices/data-plane/Language/preview/2022-10-01-preview/*.json"
        ],
        swaggerPaths: filePaths,
        enableRoundTripValidator: true,
        excludedSwaggerPathsPattern: []
      };
      const validator = new LiveValidator(options);
      await validator.initialize();

      //roundtrip validation
      const payload: RequestResponsePair = require(`${__dirname}/liveValidation/payloads/roundTrip_circularReference_analyzetext.json`);
      const rest = await validator.validateRoundTrip(payload);
      assert.equal(rest.errors.length, 5);
      assert.equal(rest.isSuccessful, false);
      for (const re of rest.errors) {
        if (re.pathsInPayload[0].includes("text")) {
          assert.equal(re.code, "ROUNDTRIP_ADDITIONAL_PROPERTY");
        } else if (re.pathsInPayload[0].includes("defaultLanguage")) {
          assert.equal(re.code, "ROUNDTRIP_INCONSISTENT_PROPERTY");
        } else if (re.pathsInPayload[0].includes("version")) {
          assert.equal(re.code, "ROUNDTRIP_MISSING_PROPERTY");
        }
      }
      //end of roundtrip validation
    });

  });
});
