// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

// import util = require('util')
import { log } from "../util/logging"
import * as validate from "../validate"
import * as yargs from "yargs"

export const command = "generate-wireformat <spec-path>"

export const describe =
  "Transforms the x-ms-examples for a given operation into raw request/response format and saves " +
  "them in a markdown file."

export const builder: yargs.CommandBuilder = {
  d: {
    alias: "outDir",
    describe:
      "The output directory where the raw request/response markdown files need to be stored. " +
      "If not provided and if the spec-path is a local file path then the output will be stored " +
      'in a folder named "wire-format" adjacent to the directory of the swagger spec. ' +
      'If the spec-path is a url then output will be stored in a folder named "wire-fromat" ' +
      "inside the current working directory.",
    strting: true,
  },
  o: {
    alias: "operationIds",
    describe:
      "A comma separated string of operationIds for which the examples need to be transformed. " +
      "If operationIds are not provided then the entire spec will be processed. " +
      'Example: "StorageAccounts_Create, StorageAccounts_List, Usages_List".',
    string: true,
  },
  y: {
    alias: "inYaml",
    describe:
      "A boolean flag when provided will indicate the tool to " +
      "generate wireformat in a yaml doc. Default is a markdown doc.",
    boolean: true,
  },
}

export async function handler(argv: yargs.Arguments) {
  log.debug(argv.toString())
  const specPath = argv.specPath
  const operationIds = argv.operationIds
  const outDir = argv.outDir
  const emitYaml = argv.inYaml
  const vOptions = {
    consoleLogLevel: argv.logLevel,
    logFilepath: argv.f,
  }

  try {
    if (specPath.match(/.*composite.*/ig) !== null) {
      return await validate.generateWireFormatInCompositeSpec(specPath, outDir, emitYaml, vOptions)
    } else {
      return await validate.generateWireFormat(specPath, outDir, emitYaml, operationIds, vOptions)
    }
  } catch (err) {
    process.exitCode = 1
  }
}
