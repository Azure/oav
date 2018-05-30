#!/usr/bin/env node

import * as yargs from 'yargs'
import * as os from 'os'
import { log } from './lib/util/logging'

const defaultLogDir = log.directory
const logFilepath = log.filepath
const packageVersion = require('./package.json').version

yargs
  .version(packageVersion)
  .commandDir('lib/commands')
  .strict()
  .option('h', { alias: 'help' })
  .option('l', {
    alias: 'logLevel',
    describe: 'Set the logging level for console.',
    choices: ['off', 'json', 'error', 'warn', 'info', 'verbose', 'debug', 'silly'],
    default: 'info'
  })
  .option('f', {
    alias: 'logFilepath',
    describe: `Set the log file path. It must be an absolute filepath. ` +
      `By default the logs will stored in a timestamp based log file at "${defaultLogDir}".`
  })
  .global(['h', 'l', 'f'])
  .help()
  .argv

if (yargs.argv._.length === 0 && yargs.argv.h === false) {
  yargs.coerce('help', function (arg: any) { return true; }).argv
}