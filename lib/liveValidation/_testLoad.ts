import "reflect-metadata";
import { LiveValidator } from "./liveValidator";

const main = async () => {
  const liveValidator = new LiveValidator(
    {
      directory: "/home/htc/azure-rest-api-specs",
      swaggerPathsPattern: ["specification/**/*.json"],
      loadValidatorInInitialize: true,
      loadValidatorInBackground: false,
      // useUnifiedModelCache: true,
      useJsonParser: false,
    },
    (msg, level, _meta) => {
      if (level !== "debug") {
        console.log(level, msg);
      }
    }
  );
  await liveValidator.initialize();
  global.gc();
  await new Promise((resolve) => setTimeout(resolve, 5000));
  debugger;
  global.gc();
  console.log(JSON.stringify(process.memoryUsage(), null, 2));
};

main().catch((err) => {
  console.error(err);
});
