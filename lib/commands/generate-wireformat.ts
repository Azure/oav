// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import util = require('util')
import log = require('../util/logging')
import validate = require('../validate')

export let command = 'generate-wireformat <spec-path>'

export let describe =
  'Transforms the x-ms-examples for a given operation into raw request/response format and saves them in a markdown file.'

export let builder = {
  d: {
    alias: 'outDir',
    describe: 'The output directory where the raw request/response markdown files need to be stored. If not provided and if the spec-path is a ' +
      'local file path then the output will be stored in a folder named "wire-format" adjacent to the directory of the swagger spec. If the spec-path is a url then ' +
      'output will be stored in a folder named "wire-fromat" inside the current working directory.',
    strting: true
  },
  o: {
    alias: 'operationIds',
    describe: 'A comma separated string of operationIds for which the examples ' +
      'need to be transformed. If operationIds are not provided then the entire spec will be processed. ' +
      'Example: "StorageAccounts_Create, StorageAccounts_List, Usages_List".',
    string: true
  },
  y: {
    alias: 'inYaml',
    describe: 'A boolean flag when provided will indicate the tool to ' +
      'generate wireformat in a yaml doc. Default is a markdown doc.',
    boolean: true
  }
}

export let handler = function (argv: any) {
  log.debug(argv)
  let specPath = argv.specPath
  let operationIds = argv.operationIds
  let outDir = argv.outDir
  let vOptions: any = {}
  let emitYaml = argv.inYaml
  vOptions.consoleLogLevel = argv.logLevel
  vOptions.logFilepath = argv.f

  function execWireFormat() {
    if (specPath.match(/.*composite.*/ig) !== null) {
      return validate.generateWireFormatInCompositeSpec(specPath, outDir, emitYaml, vOptions)
    } else {
      return validate.generateWireFormat(specPath, outDir, emitYaml, operationIds, vOptions)
    }
  }
  return execWireFormat().catch((err: any) => { process.exitCode = 1 })
}
