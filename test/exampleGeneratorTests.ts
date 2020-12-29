import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import ExampleGenerator from "../lib/generator/exampleGenerator";
import { ModelValidationError } from "../lib/util/modelValidationError";
import { generateExamples } from "../lib/validate";

const payloadDir = `test/exampleGenerator/payloads`;
const specRepoDir = `azure-rest-api-specs`;
jest.setTimeout(999999);
describe.skip("mock examples", () => {
  const specFilePaths = getSpecFilePaths(specRepoDir);
  for (const specPath of specFilePaths) {
    const specInfo = specPath.split("/");
    const apiVersion = specInfo[specInfo.length - 2];
    const rp = specInfo[specInfo.length - 1].split(".")[0];
    it(`spec for ${rp + apiVersion}`, async () => {
      const errors: readonly ModelValidationError[] = await new ExampleGenerator(
        specPath,
        path.resolve(payloadDir, rp + apiVersion)
      ).generateAll();
      if (errors.length > 0) {
        console.error(errors);
      }
      assert.strictEqual(errors.length, 0);
    });
  }
});

describe("test generate example",()=> {
  const originalError = console.error;
  const originalLog = console.log;
  let consoleOutput: any[] = [];
  const mockedLog = (output: any) => consoleOutput.push(output);
  const mockedError = (output: any) => consoleOutput.push(output);
  beforeAll(() => {
    consoleOutput = []
    console.log = mockedLog
    console.error = mockedError
  });

  afterAll(() => {
    console.error = originalError;
    console.log = originalLog;
  })
 
  test.each<string[]>([
    ["sql", "package-pure-2020-02-preview"],
    ["signalr", "package-2020-05-01"],
    ["eventgrid", "package-2020-06"]
  ])(
    "from payload,rp:%s",
    async (resourceProviderName, tag) => {
      await generateExamples(
        "",
        payloadDir,
        undefined,
        `test/exampleGenerator/specification/${resourceProviderName}/resource-manager/readme.md`,
        tag
      );
      expect(consoleOutput).toMatchSnapshot(`,tag:${tag}`);
    },
    1000000
  );
  
  test.each<string[]>([
    ["sql", "package-pure-2020-02-preview"],
    ["signalr", "package-2020-05-01"],
    ["eventgrid", "package-2020-06"]
  ])(
    "from mocker,readme:%s",
    async (resourceProviderName, tag) => {
      await generateExamples(
        "",
        undefined,
        undefined,
        `test/exampleGenerator/specification/${resourceProviderName}/resource-manager/readme.md`,
        tag
      );
      expect(consoleOutput).toMatchSnapshot(`,tag:${tag}`);
    },
    1000000
  );

})

export function getSpecFilePaths(repoDir: string) {
  const rpList = fs.readdirSync(path.resolve(repoDir, "specification"));

  const specPath: string[] = [];
  rpList.forEach((rp: string) => {
    if (!fs.existsSync(path.resolve(repoDir, "specification", rp, "resource-manager"))) {
      return;
    }
    const fullRps = fs
      .readdirSync(path.resolve(repoDir, "specification", rp, "resource-manager"))
      .filter((s) => s.startsWith("Microsoft."));
    if (fullRps.length !== 1) {
      return;
    }
    const stablePath = path.resolve(
      repoDir,
      "specification",
      rp,
      "resource-manager",
      fullRps[0],
      "stable"
    );
    if (!fs.existsSync(stablePath)) {
      return;
    }
    const versions = fs.readdirSync(stablePath).sort((i, j) => j.localeCompare(i));
    if (versions.length === 0) {
      return;
    }
    const filePath = path.resolve(stablePath, versions[0], `${rp}.json`);
    if (!fs.existsSync(filePath)) {
      return;
    }
    specPath.push(filePath);
  });
  return specPath;
}
