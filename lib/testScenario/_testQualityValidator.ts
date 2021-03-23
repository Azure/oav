import "reflect-metadata";
import * as fs from "fs";
import { ExampleQualityValidator } from "../exampleQualityValidator/exampleQualityValidator";
import { SwaggerExample } from "../swagger/swaggerTypes";

// oav generate-postmanCollection testScenario --env
const main = async () => {
  const validator = ExampleQualityValidator.create({
    swaggerFilePaths: [
      "/home/ruowan/work/azure-rest-api-specs/specification/containerservice/resource-manager/Microsoft.ContainerService/stable/2020-12-01/managedClusters.json",
      "/home/ruowan/work/azure-rest-api-specs/specification/compute/resource-manager/Microsoft.Compute/preview/2020-10-01-preview/cloudService.json",
      "/home/ruowan/work/azure-rest-api-specs-tih/specification/compute/resource-manager/Microsoft.Compute/stable/2020-12-01/compute.json",
    ],
  });
  // await validator.validate();
  await validator.validateSwaggerExamples();
  await validateExternalExample(
    "/home/ruowan/work/oav/generated/exampleFileMappingGallery.json",
    [
      "/home/ruowan/work/azure-rest-api-specs/specification/compute/resource-manager/Microsoft.Compute/preview/2020-09-30/gallery.json",
    ],
    "galleryQuality.json"
  );
  await validateExternalExample(
    "/home/ruowan/work/oav/generated/exampleFileMappingAKS.json",
    [
      "/home/ruowan/work/azure-rest-api-specs/specification/containerservice/resource-manager/Microsoft.ContainerService/stable/2020-12-01/managedClusters.json",
    ],
    "aksQuality.json"
  );
};

console.time("TestLoad");
console.log("Start");

main().finally(() => {
  console.timeEnd("TestLoad");
});
async function validateExternalExample(
  exampleMappingFilePath: string,
  swaggerFilePaths: string[],
  output: string
) {
  const exampleMapping = JSON.parse(fs.readFileSync(exampleMappingFilePath).toString());
  const galleryValidator = ExampleQualityValidator.create({
    swaggerFilePaths: swaggerFilePaths,
  });
  const input: Array<{
    exampleFilePath: string;
    example: SwaggerExample;
    operationId: string;
  }> = [];
  for (const key of Object.keys(exampleMapping)) {
    input.push({
      exampleFilePath: key,
      example: JSON.parse(fs.readFileSync(key).toString()),
      operationId: exampleMapping[key],
    });
  }
  const res = await galleryValidator.validateExternalExamples(input);
  fs.writeFileSync(`generated/${output}`, JSON.stringify(res, null, 2));
}
