// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import util = require('util')
import log = require('../util/logging')
import validate = require('../validate')

export let command = 'extract-xmsexamples <spec-path> <recordings>'

export let describe =
  'Extracts the x-ms-examples for a given swagger from the .NET session recordings and saves them in a file.'

export let builder = {
  d: {
    alias: 'outDir',
    describe: 'The output directory where the x-ms-examples files need to be stored. If not provided ' +
      'then the output will be stored in a folder name "output" adjacent to the working directory.',
    string: true
  },
  m: {
    alias: 'matchApiVersion',
    describe: 'Only generate examples if api-version matches.',
    boolean: true,
    default: true
  }
}

export let handler = function (argv: any) {
  log.debug(argv)
  let specPath = argv.specPath
  let recordings = argv.recordings
  let vOptions: any = {}
  vOptions.consoleLogLevel = argv.logLevel
  vOptions.logFilepath = argv.f
  vOptions.output = argv.outDir
  vOptions.matchApiVersion = argv.matchApiVersion

  return validate.extractXMsExamples(specPath, recordings, vOptions)
}
