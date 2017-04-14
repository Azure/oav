// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';
var util = require('util'),
  log = require('../util/logging'),
  validate = require('../validate');

exports.command = 'resolve-spec <spec-path>';

exports.describe = 'Resolves the swagger spec based on the selected options.';

exports.builder = {
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
  d: {
    alias: 'outputDir',
    describe: 'Output directory where the resolved swagger spec will be stored.',
    string: true,
    default: './'
  }
};

exports.handler = function (argv) {
  log.debug(argv);
  let specPath = argv.specPath;
  let vOptions = {};
  vOptions.consoleLogLevel = argv.logLevel;
  vOptions.logFilepath = argv.f;
  vOptions.shouldResolveRelativePaths = argv.r;
  vOptions.shouldResolveXmsExamples = argv.e;
  vOptions.shouldResolveAllOf = argv.o;
  vOptions.shouldSetAdditionalPropertiesFalse = argv.a;
  vOptions.shouldResolvePureObjects = argv.p;

  function execResolve() {
    if (specPath.match(/.*composite.*/ig) !== null) {
      return validate.validateCompositeSpec(specPath, argv.d, vOptions);
    } else {
      return validate.resolveSpec(specPath, argv.d, vOptions);
    }
  }
  execResolve();
};

exports = module.exports;