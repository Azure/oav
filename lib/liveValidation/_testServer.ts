import "reflect-metadata";
import { createServer } from "http";
import { Readable } from "stream";
import { LiveValidator } from "./liveValidator";

const streamToString = (stream: Readable) => {
  return new Promise<string>((resolve, reject) => {
    let str = "";
    stream.on("data", (data) => {
      str += data;
    });
    stream.on("end", () => {
      resolve(str);
    });
    stream.on("error", (err) => {
      reject(err);
    });
  });
};

const main = async () => {
  const liveValidator = new LiveValidator(
    {
      directory: "/home/htc/azure-rest-api-specs",
      swaggerPathsPattern: ["specification/**/resource-manager/**/*.json"],
      loadValidatorInInitialize: true,
      loadValidatorInBackground: false,
      useUnifiedModelCache: true,
      useJsonParser: false,
    },
    (msg, level, _meta) => {
      if (level !== "debug") {
        console.log(level, msg);
      }
    }
  );

  const server = createServer(async (req, res) => {
    let result;

    try {
      const bodyStr = await streamToString(req);
      const body = JSON.parse(bodyStr);
      result = await liveValidator.validateLiveRequestResponse(body);
    } catch (e) {
      result = {
        message: e.message,
        stack: e.stack,
      };
    }
    const resultStr = JSON.stringify(result);

    res.writeHead(200, { "Content-Type": "text/json" });
    res.end(resultStr);
  });

  await liveValidator.initialize();
  server.listen(8080);
  await new Promise((resolve) => setTimeout(resolve, 500));
  console.log(JSON.stringify(process.memoryUsage(), null, 2));
};

main().catch((err) => {
  console.error(err);
});
