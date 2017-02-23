#!/usr/bin/env node

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var yargs = require('yargs'),
  os = require('os'),
  log = require('./lib/util/logging');

var defaultLogDir = log.directory;
var logFilepath = log.filepath;

yargs
  .version("0.1.0")
  .commandDir('lib/commands')
  .option('h', {alias: 'help'})
  .option('j', {alias: 'json', describe: 'Show json output', boolean: true})
  .option('l', {
    alias: 'logLevel',
    describe: 'Set the logging level for console.',
    choices: ['json', 'error', 'warn', 'info' , 'verbose', 'debug', 'silly'], 
    default: 'warn'
  })
  .option('f', {
    alias: 'logFilepath',
    describe: `Set the log file path. It must be an absolute filepath. ` + 
    `By default the logs will stored in a timestamp based log file at "${defaultLogDir}".`
  })
  .global(['h', 'j', 'l', 'f'])
  .help()
  .argv;

//setting console logging level to the value provided by the user.
//log.consoleLogLevel = yargs.argv.l;

//setting the logFilePath if provided.
log.filepath = yargs.argv.f || logFilepath;

if (yargs.argv._.length === 0 && yargs.argv.h === false && yargs.argv.j === false) {
  yargs.coerce('help', function(arg) {return true;}).argv;
}