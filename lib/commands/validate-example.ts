// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as yargs from "yargs"

import * as iterator from "@ts-common/iterator"
import { cliSuppressExceptions } from "../cliSuppressExceptions"
import { log } from "../util/logging"
import * as validate from "../validate"

export const command = "validate-example <spec-path>"

export const describe = "Performs validation of x-ms-examples and examples present in the spec."

export const builder: yargs.CommandBuilder = {
  o: {
    alias: "operationIds",
    describe:
      "A comma separated string of operationIds for which the examples need to be validated. " +
      "If operationIds are not provided then the entire spec will be validated. " +
      'Example: "StorageAccounts_Create, StorageAccounts_List, Usages_List".',
    string: true
  }
}

export async function handler(argv: yargs.Arguments): Promise<void> {
  await cliSuppressExceptions(async () => {
    log.debug(argv.toString())
    const specPath = argv.specPath
    const operationIds = argv.operationIds
    const vOptions: validate.Options = {
      consoleLogLevel: argv.logLevel,
      logFilepath: argv.f,
      pretty: argv.p
    }
    if (specPath.match(/.*composite.*/gi) !== null) {
      const result = await validate.validateExamplesInCompositeSpec(specPath, vOptions)
      return iterator.flat(result).some() ? 1 : 0
    } else {
      const result = await validate.validateExamples(specPath, operationIds, vOptions)
      return iterator.some(result) ? 1 : 0
    }
  })
}
