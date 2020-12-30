// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

/* eslint-disable id-blacklist */

import * as yargs from "yargs";

import { cliSuppressExceptions } from "../cliSuppressExceptions";
import { log } from "../util/logging";
import * as validate from "../validate";

export const command = "generate-examples [spec-path]";

export const describe = "Generate swagger examples from real payload records.";

export const builder: yargs.CommandBuilder = {
  o: {
    alias: "operationId",
    describe: "operation id.",
    string: true,
  },
  payload: {
    alias: "payloadDir",
    describe: "the directory path contains payload.",
    string: true,
  },
  c: {
    alias: "config",
    describe: "config path.",
    string: true,
  },
  tag: {
    alias: "tagName",
    describe: "tag name.",
    string: true,
  }
};

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    log.debug(argv.toString());
    const specPath = argv.specPath;
    const vOptions = {
      consoleLogLevel: argv.logLevel,
      logFilepath: argv.f,
    };
    await validate.generateExamples(specPath, argv.payload, argv.o, argv.config, argv.tag, vOptions);
    return 0;
  });
}
