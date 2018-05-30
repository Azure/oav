// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { log } from '../util/logging'
import * as validate from '../validate'
import * as yargs from "yargs"

export const command = 'validate-spec <spec-path>'

export const describe = 'Performs semantic validation of the spec.'

export function handler(argv: yargs.Arguments) {
  log.debug(argv.toString())
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
