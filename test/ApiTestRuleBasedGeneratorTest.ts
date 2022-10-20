import * as assert from "assert";
import { exec } from "child_process";
import { existsSync, readFileSync } from "fs";
import glob from "glob";
import {dirname, join, resolve } from "path";
import { ApiTestGeneratorRule, ApiTestRuleBasedGenerator } from "../lib/apiScenario/gen/ApiTestRuleBasedGenerator";
import { NoChildResourceCreated } from "../lib/apiScenario/gen/rules/noChildResourceCreated";
import { ResourceNameCaseInsensitive } from "../lib/apiScenario/gen/rules/resourceNameCaseInsensitive";
import { SystemDataExistsInResponse } from "../lib/apiScenario/gen/rules/systemDataExistsInResponse";
import { inversifyGetInstance } from "../lib/inversifyUtils";
import { JsonLoader } from "../lib/swagger/jsonLoader";
import { setDefaultOpts } from "../lib/swagger/loader";
import { SwaggerLoader, SwaggerLoaderOption } from "../lib/swagger/swaggerLoader";
import { getInputFiles } from "../lib/util/utils";

jest.setTimeout(9999999);

export const testApiTestRuleBase = async (
  swagger: string,
  specFolder:string,
  rule: ApiTestGeneratorRule,
  isRPaaS?: string
) => {
  const opts: SwaggerLoaderOption = {};
  setDefaultOpts(opts, {
    eraseXmsExamples: false,
    skipResolveRefKeys: ["x-ms-examples"],
  });
  const swaggerLoader = inversifyGetInstance(SwaggerLoader, opts);
  const jsonLoader = inversifyGetInstance(JsonLoader, opts);
  const generateDependencyFile = async (swagger:string,specFolder:string) => {
      const outputDir = ".restler_output"
      const rootFolder = swagger.split(/\\|\//)[0]
      const relativeSwagger = swagger.substring(rootFolder.length + 1)
      const { err, stderr } = await new Promise((res) => 
        exec(
          `docker run --rm -v $(pwd)/${rootFolder}:/swagger -w /swagger/${outputDir} mcr.microsoft.com/restlerfuzzer/restler dotnet /RESTler/restler/Restler.dll compile --api_spec /swagger/${relativeSwagger}`,
          { encoding: "utf8", maxBuffer: 1024 * 1024 * 64, cwd:specFolder },
          (err: unknown, stdout: unknown, stderr: unknown) =>
            res({ err: err,  stderr: stderr,stdout: stdout,})
        )
     ) as any;
     if (err || stderr) {
      return null
     }
     const dependencyFile = resolve(specFolder,rootFolder,outputDir,"Compile/dependencies.json")
     if (existsSync(dependencyFile)) {
       return dependencyFile
     }
     return null
  }
  const dependencyFile = await generateDependencyFile(swagger, specFolder);
  const outputDir = `${join(specFolder,dirname(swagger))}/generatedScenarios`;
  const rules: ApiTestGeneratorRule[] = [rule];
  assert.ok(dependencyFile)
  const generator = new ApiTestRuleBasedGenerator(
    swaggerLoader,
    jsonLoader,
    rules,
    resolve(specFolder,swagger),
    dependencyFile!
  );
  await generator.run(outputDir, isRPaaS ? "RPaaS" : "ARM");
  const pathPattern = resolve(outputDir,rule.name,"*.yaml")
  return glob.sync(pathPattern, {
    ignore: ["**/examples/**/*.json", "**/quickstart-templates/*.json", "**/schema/*.json"],
  });
};

function isCommonSpec(swagger:string) {
  const swaggerDefinition = JSON.parse(readFileSync(swagger).toString());
  return !swaggerDefinition.paths || Object.keys(swaggerDefinition.paths).length === 0;
}

describe("Api Test rule based generator test", () => {
  const specFolder = resolve(`${__dirname}/../regression/azure-rest-api-specs`);
  const specPaths: string[] = glob.sync(
    join(specFolder, "specification/**/resource-manager/readme.md"),
    {
      ignore: ["**/examples/**/*.json", "**/quickstart-templates/*.json", "**/schema/*.json"],
    }
  );
  const selectedRps = ["compute", "monitor", "sql", "hdinsight", "resource", "storage"];
  const allSpecs = specPaths
    .filter(
      (p: string) =>
        p.includes("resource-manager") &&
        selectedRps.some((rp: string) => p.includes(`specification/${rp}`))
    )
    .map((f) => f.substring(specFolder.length + 1));
  
  it("test NoChildResourceCreated", async () => {
    for (const readmeMd of allSpecs) {
      const inputs = (await getInputFiles(join(specFolder, readmeMd))).map((it: string) =>
        join(dirname(readmeMd), it)
      );
      for (const spec of inputs) {
        if (!isCommonSpec(join(specFolder, spec))) {
          const scenarioFiles = await testApiTestRuleBase(spec, specFolder, NoChildResourceCreated);
          assert.ok(scenarioFiles);
        }
      }
    }
  });

 it("test  ResourceNameCaseInsensitive",async ()=> {
  for(const readmeMd of allSpecs) {
    const inputs = (await getInputFiles(join(specFolder, readmeMd))).map((it: string) => join(dirname(readmeMd), it));;
    for (const spec of inputs) {
      if (!isCommonSpec(join(specFolder,spec))) {
          const scenarioFiles = await testApiTestRuleBase(
            spec,
            specFolder,
            ResourceNameCaseInsensitive
          );
          assert.ok(scenarioFiles);
      }
    }
  }
 });

 it("test SystemDataExistsInResponse", async () => {
   for (const readmeMd of allSpecs) {
     const inputs = (await getInputFiles(join(specFolder, readmeMd))).map((it: string) =>
       join(dirname(readmeMd), it)
     );
     for (const spec of inputs) {
       if (!isCommonSpec(join(specFolder, spec))) {
         const scenarioFiles = await testApiTestRuleBase(
           spec,
           specFolder,
           SystemDataExistsInResponse
         );
         assert.ok(scenarioFiles);
       }
     }
   }
 });
})