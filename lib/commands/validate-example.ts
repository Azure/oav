// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

// import util = require('util')
import { log } from "../util/logging"
import * as validate from "../validate"
import * as yargs from "yargs"

export const command = "validate-example <spec-path>"

export const describe = "Performs validation of x-ms-examples and examples present in the spec."

export const builder: yargs.CommandBuilder = {
  o: {
    alias: "operationIds",
    describe:
      "A comma separated string of operationIds for which the examples need to be validated. " +
      "If operationIds are not provided then the entire spec will be validated. " +
      'Example: "StorageAccounts_Create, StorageAccounts_List, Usages_List".',
    string: true,
  },
}

export function handler(argv: yargs.Arguments) {
  log.debug(argv.toString())
  const specPath = argv.specPath
  const operationIds = argv.operationIds
  const vOptions = {
    consoleLogLevel: argv.logLevel,
    logFilepath: argv.f,
  }
  if (specPath.match(/.*composite.*/ig) !== null) {
    return validate.validateExamplesInCompositeSpec(specPath, vOptions)
  } else {
    return validate.validateExamples(specPath, operationIds, vOptions)
  }
}
