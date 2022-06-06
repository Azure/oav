import assert from "assert";
import * as fs from "fs";
import * as path from "path";
import ExampleGenerator from "../lib/generator/exampleGenerator";
import { ModelValidationError } from "../lib/util/modelValidationError";
import { generateExamples } from "../lib/validate";
import { log } from "../lib/util/logging";

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

describe.skip("test generate example", () => {
  const originalError = log.error;
  //const originalLog = log.info;
  const originalWarn = log.warn;
  let consoleOutput: any[] = [];
  const recordOutput = (output: any) => {
    if (typeof output === "string" && output.indexOf("\\") !== -1) {
      const result = output.replace(/\\/gi, "/");
      consoleOutput.push(result);
    } else {
      consoleOutput.push(output);
    }
  };
  //const mockedLog = (output: any) => recordOutput(output);
  const mockedError = (output: any) => recordOutput(output);
  const mockedWarn = (output: any) => recordOutput(output);
  beforeAll(() => {
    consoleOutput = [];
    //log.info = mockedLog as any
    log.error = mockedError as any;
    log.warn = mockedWarn as any;
  });

  afterAll(() => {
    log.error = originalError;
    //log.info = originalLog;
    log.warn = originalWarn;
  });

  test.each<string[]>([
    ["sql", "package-pure-2020-02-preview"],
    ["signalr", "package-2020-05-01"],
    ["eventgrid", "package-2020-06"],
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
    ["eventgrid", "package-2020-06"],
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
});

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
