#!/usr/bin/env node

import "reflect-metadata";
import { createRequire } from "module";
import yargs from "yargs";
import { log } from "./lib/util/logging.js";
import * as extractXmsExamples from "./lib/commands/extract-xmsexamples.js";
import * as generateExamples from "./lib/commands/generate-examples.js";
import * as trafficConverter from "./lib/commands/traffic-converter.js";
import * as validateExample from "./lib/commands/validate-example.js";
import * as validateSpec from "./lib/commands/validate-spec.js";
import * as validateTraffic from "./lib/commands/validate-traffic.js";

const require = createRequire(import.meta.url);

const defaultLogDir = log.directory;

const packageVersion = require("../package.json").version;

// eslint-disable-next-line no-unused-expressions
yargs
  .version(packageVersion)
  .command(extractXmsExamples)
  .command(generateExamples)
  .command(trafficConverter)
  .command(validateExample)
  .command(validateSpec)
  .command(validateTraffic)
  .strict()
  .option("h", { alias: "help" })
  .option("l", {
    alias: "logLevel",
    describe: "Set the logging level for console.",
    choices: ["off", "json", "error", "warn", "info", "verbose", "debug", "silly"],
    default: "info",
  })
  .option("f", {
    alias: "logFilepath",
    describe:
      `Set the log file path. It must be an absolute filepath. ` +
      `By default the logs will stored in a timestamp based log file at "${defaultLogDir}".`,
  })
  .option("p", {
    alias: "pretty",
    describe: `Pretty print`,
  })
  .global(["h", "l", "f", "p"])
  .help().argv;

if (yargs.argv._.length === 0 && yargs.argv.h === false) {
  yargs.coerce("help", (_) => true);
}
