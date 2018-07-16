// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { log } from "../util/logging"
import * as validate from "../validate"
import * as yargs from "yargs"

export const command = "validate-spec <spec-path>"

export const describe = "Performs semantic validation of the spec."

export async function handler(argv: yargs.Arguments): Promise<void> {
  log.debug(argv.toString())
  const specPath = argv.specPath
  const vOptions: validate.Options = {
    consoleLogLevel: argv.logLevel,
    logFilepath: argv.f,
    pretty: argv.p,
  }
  if (specPath.match(/.*composite.*/ig) !== null) {
    await validate.validateCompositeSpec(specPath, vOptions)
  } else {
    await validate.validateSpec(specPath, vOptions)
  }
}
