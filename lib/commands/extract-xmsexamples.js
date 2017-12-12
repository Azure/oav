// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';
var util = require('util'),
  log = require('../util/logging'),
  validate = require('../validate');

exports.command = 'extract-xmsexamples <spec-path> <recordings>';

exports.describe = 'Extracts the x-ms-examples for a given swagger from the .NET session recordings and saves them in a file.';

exports.builder = {
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
};

exports.handler = function (argv) {
  log.debug(argv);
  let specPath = argv.specPath;
  let recordings = argv.recordings;
  let vOptions = {};
  vOptions.consoleLogLevel = argv.logLevel;
  vOptions.logFilepath = argv.f;
  vOptions.output = argv.outDir;
  vOptions.matchApiVersion = argv.matchApiVersion;

  return validate.extractXMsExamples(specPath, recordings, vOptions);
}

exports = module.exports;
