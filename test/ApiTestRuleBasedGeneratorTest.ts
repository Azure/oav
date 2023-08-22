import * as assert from "assert";
import { exec } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { mkdirpSync } from "fs-extra";
import glob from "glob";
import {
  ApiTestGeneratorRule,
  ApiTestRuleBasedGenerator,
} from "../lib/apiScenario/gen/ApiTestRuleBasedGenerator";
import { NoChildResourceCreated } from "../lib/apiScenario/gen/rules/noChildResourceCreated";
import { ResourceNameCaseInsensitive } from "../lib/apiScenario/gen/rules/resourceNameCaseInsensitive";
import { SystemDataExistsInResponse } from "../lib/apiScenario/gen/rules/systemDataExistsInResponse";
import { inversifyGetInstance } from "../lib/inversifyUtils";
import { JsonLoader } from "../lib/swagger/jsonLoader";
import { setDefaultOpts } from "../lib/swagger/loader";
import { SwaggerLoader, SwaggerLoaderOption } from "../lib/swagger/swaggerLoader";
import { getInputFiles, resetPseudoRandomSeed } from "../lib/util/utils";

jest.setTimeout(9999999);

export const testApiTestRuleBase = async (
  swaggers: string[],
  specFolder: string,
  rules: ApiTestGeneratorRule[],
  isRPaaS?: string
) => {
  const opts: SwaggerLoaderOption = {};
  setDefaultOpts(opts, {
    eraseXmsExamples: false,
    skipResolveRefKeys: ["x-ms-examples"],
  });
  const swaggerLoader = inversifyGetInstance(SwaggerLoader, opts);
  const jsonLoader = inversifyGetInstance(JsonLoader, opts);

  const generateDependencyFile = async (swaggers: string[], specFolder: string) => {
    const outputDir = `.restler_output_${swaggers[0].split("/")[1]}`;
    const restlerConfig = {
      SwaggerSpecFilePath: swaggers.map((s) => join("/swagger", s)),
    };
    const restlerConfigFile = join("restler_config", "config.json");
    if (!existsSync(dirname(join(specFolder, restlerConfigFile)))) {
      mkdirpSync(dirname(join(specFolder, restlerConfigFile)));
    }
    writeFileSync(join(specFolder, restlerConfigFile), JSON.stringify(restlerConfig));
    const { err, stderr } = (await new Promise((res) =>
      exec(
        `docker run --rm -v $(pwd):/swagger -w /swagger/${outputDir} mcr.microsoft.com/restlerfuzzer/restler dotnet /RESTler/restler/Restler.dll compile /swagger/${restlerConfigFile}`,
        { encoding: "utf8", maxBuffer: 1024 * 1024 * 64, cwd: specFolder },
        (err: unknown, stdout: unknown, stderr: unknown) =>
          res({ err: err, stderr: stderr, stdout: stdout })
      )
    )) as any;
    if (err || stderr) {
      console.log(err || stderr);
    }
    const dependencyFile = resolve(specFolder, outputDir, "Compile/dependencies.json");
    if (existsSync(dependencyFile)) {
      return dependencyFile;
    }
    console.log(`Could not find dependency file:${dependencyFile}.`);
    return null;
  };
  const dependencyFile = await generateDependencyFile(swaggers, specFolder);
  const outputDir = `${join(specFolder, dirname(swaggers[0]))}/generatedScenarios`;
  assert.ok(dependencyFile);
  const generator = new ApiTestRuleBasedGenerator(
    swaggerLoader,
    jsonLoader,
    rules,
    swaggers.map((s) => resolve(specFolder, s)),
    dependencyFile!
  );
  await generator.run(outputDir, isRPaaS ? "RPaaS" : "ARM");
  const pathPattern = resolve(outputDir, "*.yaml");
  return glob.sync(pathPattern, {
    ignore: ["**/examples/**/*.json", "**/quickstart-templates/*.json", "**/schema/*.json"],
  });
};

async function testApiTestRuleBaseForReadme(
  readmeMd: string,
  specFolder: string,
  rules: ApiTestGeneratorRule[],
  isRPaaS?: string
) {
  const inputs = (await getInputFiles(join(specFolder, readmeMd))).map((it: string) =>
    join(dirname(readmeMd), it)
  );
  return await testApiTestRuleBase(
    inputs.filter((spec) => !isCommonSpec(join(specFolder, spec))),
    specFolder,
    rules,
    isRPaaS
  );
}

function isCommonSpec(swagger: string) {
  const swaggerDefinition = JSON.parse(readFileSync(swagger).toString());
  return !swaggerDefinition.paths || Object.keys(swaggerDefinition.paths).length === 0;
}

describe("Api Test rule based generator test", () => {
  beforeEach(() => {
    resetPseudoRandomSeed(0);
  });

  const specFolder = resolve(`${__dirname}/../regression/azure-rest-api-specs`);
  const specPaths: string[] = glob.sync(
    join(specFolder, "specification/**/resource-manager/readme.md"),
    {
      ignore: ["**/examples/**/*.json", "**/quickstart-templates/*.json", "**/schema/*.json"],
    }
  );
  const selectedRps = ["appconfiguration", "monitor", "sql", "hdinsight", "resource", "storage"];
  const allSpecs = specPaths
    .filter((p: string) => selectedRps.some((rp: string) => p.includes(`specification/${rp}/`)))
    .map((f) => f.substring(specFolder.length + 1));

  it("test rules", async () => {
    for (const readmeMd of allSpecs) {
      const scenarioFiles = await testApiTestRuleBaseForReadme(readmeMd, specFolder, [
        NoChildResourceCreated,
        ResourceNameCaseInsensitive,
        SystemDataExistsInResponse,
      ]);
      assert.ok(scenarioFiles);
    }
  });
});
