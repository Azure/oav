import { FileLoader } from "../lib/swagger/fileLoader";
import { OperationLoader } from "../lib/armValidator/operationLoader";
import { assert } from "console";

describe("Live Validator", () => {
  describe("Initialization", () => {
    it("should initialize with defaults", async () => {
      console.log("Hello world");

      const fileLoader = new FileLoader({

      });
      const ruleMap = new Map<string, string>([
        ["readOnly", "$..[?(@.readOnly)]~"],
        ["description", '$..[?(@["description"])]~']
      ]);

      const operationLoader = new OperationLoader(fileLoader, ruleMap);
      const filePath = "/home/adqi/oav/test/liveValidation/swaggers/specification/apimanagement/resource-manager/Microsoft.ApiManagement/preview/2018-01-01/apimapis.json";
      const spec = await operationLoader.init(filePath);
      assert(spec !== undefined);
    });
  });
});
