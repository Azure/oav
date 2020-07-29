/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable no-console */
import { readFileSync } from "fs";
import { SwaggerValidator } from "./validators/swaggerValidator";
import { SwaggerLiveValidatorLoader } from "./swagger/swaggerLiveValidatorLoader";

// const stdinLines =
//   "/home/htc/dev/azure-rest-api-specs/specification/network/resource-manager/Microsoft.Network/stable/2020-05-01/loadBalancer.json";

const load = async () => {
  const loader = new SwaggerLiveValidatorLoader("/home/htc/azure-rest-api-specs/specification", {
    transformToNewSchemaFormat: false,
  });

  // loader.ajv.addSchema({
  //   id: "_test.json",
  //   definitions: {
  //     A: {
  //       properties: {
  //         kind: { type: "string" },
  //       },
  //       select: { $data: "0/kind" },
  //       selectCases: {
  //         B: { $ref: "_test.json#/definitions/B" },
  //       },
  //     },
  //     B: {
  //       allOf: [
  //         {
  //           $ref: "_test.json#/definitions/A",
  //         },
  //       ],
  //       properties: {
  //         b: {
  //           type: "string",
  //         },
  //       },
  //     },
  //   },
  // });
  // const v = loader.ajv.compile({
  //   properties: {
  //     a: {
  //       $ref: "_test.json#/definitions/A",
  //     },
  //   },
  // });
  // v({
  //   a: {
  //     kind: "B",
  //     b: 123,
  //     c: 123,
  //   },
  // });

  // console.log(JSON.stringify(v.errors, null, 2));

  const documents: any[] = [];
  const stdinLines = readFileSync(0).toString();
  for (const filePath of stdinLines.split("\n")) {
    if (filePath === "") {
      continue;
    }
    console.time(filePath);
    const validator = new SwaggerValidator(filePath, {});
    try {
      const spec = await validator.initialize(loader);
      await loader.buildAjvValidator(spec);
      documents.push(validator);
    } catch (err) {
      console.error(err);
    }
    console.timeEnd(filePath);
  }

  console.log(process.memoryUsage());

  return documents;
};

(async () => {
  console.time("Load swagger specs");
  let documents: any[] | undefined = undefined;
  try {
    documents = await load();
  } catch (e) {
    console.error(e);
  }
  if (global.gc !== undefined) {
    global.gc();
  }
  console.log(documents?.[0]);
  console.log(documents?.length);
  console.timeEnd("Load swagger specs");
  await new Promise((resolve) => setTimeout(resolve, 100));
  const usage = process.memoryUsage();
  console.log(usage);
  console.log((usage.heapUsed + usage.external) / 1024 / 1024);
})();
