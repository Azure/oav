// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import util = require('util')
import log = require('../util/logging')
import validate = require('../validate')

export let command = 'resolve-spec <spec-path>'

export let describe =
  'Resolves the swagger spec based on the selected options like allOfs, relativePaths, examples etc.'

export let builder = {
  a: {
    alias: 'additionalPropertiesFalse',
    describe: 'Should additionalProperties be set to false?',
    boolean: true,
    default: false
  },
  e: {
    alias: 'examples',
    describe: 'Should x-ms-examples be resolved?',
    boolean: true,
    default: false
  },
  o: {
    alias: 'allOf',
    describe: 'Should allOf references be resolved?',
    boolean: true,
    default: false
  },
  p: {
    alias: 'pureObjects',
    describe: 'Should pure objects be resolved?',
    boolean: true,
    default: false
  },
  r: {
    alias: 'relativePaths',
    describe: 'Should relative paths be resolved?',
    boolean: true,
    default: false
  },
  c: {
    alias: 'discriminator',
    describe: 'Should discriminator be resolved?',
    boolean: true,
    default: false
  },
  t: {
    alias: 'parameterizedHost',
    describe: 'Should "x-ms-parameterized-host" extension be resolved?',
    boolean: true,
    default: false
  },
  n: {
    alias: 'nullable',
    describe: 'Should nullable types be resolved?',
    boolean: true,
    default: false
  },
  d: {
    alias: 'outputDir',
    describe: 'Output directory where the resolved swagger spec will be stored.',
    string: true,
    default: './'
  }
}

export let handler = function (argv: any) {
  log.debug(argv)
  let specPath = argv.specPath
  let vOptions: any = {}
  vOptions.consoleLogLevel = argv.logLevel
  vOptions.logFilepath = argv.f
  vOptions.shouldResolveRelativePaths = argv.r
  vOptions.shouldResolveXmsExamples = argv.e
  vOptions.shouldResolveAllOf = argv.o
  vOptions.shouldSetAdditionalPropertiesFalse = argv.a
  vOptions.shouldResolveParameterizedHost = argv.t
  vOptions.shouldResolvePureObjects = argv.p
  vOptions.shouldResolveDiscriminator = argv.c
  vOptions.shouldResolveNullableTypes = argv.n

  function execResolve() {
    if (specPath.match(/.*composite.*/ig) !== null) {
      return validate.resolveCompositeSpec(specPath, argv.d, vOptions)
    } else {
      return validate.resolveSpec(specPath, argv.d, vOptions)
    }
  }
  return execResolve().catch((err: any) => { process.exitCode = 1 })
}
