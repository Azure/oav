// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import { log } from '../util/logging'
import * as validate from '../validate'

export const command = 'generate-uml <spec-path>'

export const describe = 'Generates a class diagram of the model definitions in the given swagger spec.'

export const builder = {
  d: {
    alias: 'outputDir',
    describe: 'Output directory where the class diagram will be stored.',
    string: true,
    default: './'
  },
  p: {
    alias: 'disableProperties',
    describe: 'Should model properties not be generated?',
    boolean: true,
    default: false
  },
  a: {
    alias: 'disableAllof',
    describe: 'Should allOf references not be generated?',
    boolean: true,
    default: false
  },
  r: {
    alias: 'disableRefs',
    describe: 'Should model references not be generated?',
    boolean: true,
    default: false
  },
  i: {
    alias: 'direction',
    describe: 'The direction of the generated diagram:\n' +
      '"TB" - TopToBottom (default),\n' + '"LR" - "LeftToRight",\n' + '"RL" - "RightToLeft"',
    string: true,
    default: "TB",
    choices: ["TB", "LR", "RL"]
  }
}

export function handler(argv: any) {
  log.debug(argv)
  let specPath = argv.specPath
  let vOptions: any = {}
  vOptions.consoleLogLevel = argv.logLevel
  vOptions.logFilepath = argv.f
  vOptions.shouldDisableProperties = argv.p
  vOptions.shouldDisableAllof = argv.a
  vOptions.shouldDisableRefs = argv.r
  vOptions.direction = argv.i
  function execGenerateUml() {
    return validate.generateUml(specPath, argv.d, vOptions)
  }
  return execGenerateUml().catch((err: any) => { process.exitCode = 1; })
}
