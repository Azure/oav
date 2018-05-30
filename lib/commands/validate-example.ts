// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import util = require('util')
import { log } from '../util/logging'
import validate = require('../validate')

export let command = 'validate-example <spec-path>'

export let describe = 'Performs validation of x-ms-examples and examples present in the spec.'

export let builder = {
  o: {
    alias: 'operationIds',
    describe: 'A comma separated string of operationIds for which the examples ' +
      'need to be validated. If operationIds are not provided then the entire spec will be validated. ' +
      'Example: "StorageAccounts_Create, StorageAccounts_List, Usages_List".',
    string: true
  }
}

export let handler = function (argv: any) {
  log.debug(argv)
  let specPath = argv.specPath
  let operationIds = argv.operationIds
  let vOptions: any = {}
  vOptions.consoleLogLevel = argv.logLevel
  vOptions.logFilepath = argv.f
  if (specPath.match(/.*composite.*/ig) !== null) {
    return validate.validateExamplesInCompositeSpec(specPath, vOptions)
  } else {
    return validate.validateExamples(specPath, operationIds, vOptions)
  }
}
