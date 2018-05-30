// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

// import util = require('util')
import { log } from '../util/logging'
import * as validate from '../validate'

export let command = 'validate-spec <spec-path>'

export let describe = 'Performs semantic validation of the spec.'

export let handler = function (argv: any) {
  log.debug(argv)
  let specPath = argv.specPath
  let vOptions: any = {}
  vOptions.consoleLogLevel = argv.logLevel
  vOptions.logFilepath = argv.f

  if (specPath.match(/.*composite.*/ig) !== null) {
    return validate.validateCompositeSpec(specPath, vOptions)
  } else {
    return validate.validateSpec(specPath, vOptions)
  }
}
