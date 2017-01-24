// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var yargs = require('yargs'),
  log = require('./lib/util/logging');

yargs
  .version("0.1.0")
  .commandDir('lib/commands')
  .option('h', {alias: 'help'})
  .option('j', {alias: 'json', describe: 'Show json output', boolean: true})
  .option('l', {alias: 'logLevel', describe: 'Set the logging level for console.', choices: ['error', 'warn', 'info' , 'verbose', 'debug', 'silly'], default: 'warn'})
  .global(['h', 'j', 'l'])
  .help()
  .argv;

//setting console logging level to the value provided by the user.
log.consoleLogLevel = yargs.argv.l;

if (yargs.argv._.length === 0 && yargs.argv.h === false && yargs.argv.j === false) {
  yargs.coerce('help', function(arg) {return true;}).argv;
}