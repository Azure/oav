// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var winston = require('winston'),
  path = require('path'),
  fs = require('fs'),
  logDir = path.resolve(__dirname, '../..', 'output');

var currentLogFile;

var logger = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
      level: 'warn',
      colorize: true,
      prettyPrint: true,
      humanReadableUnhandledException: true
    }),
    new (winston.transports.File)({
      level: 'silly',
      colorize: false,
      silent: false,
      prettyPrint: true,
      json: false,
      filename: getLogFilePath()
    })
  ]
});

/*
 * Provides current time in custom format that will be used in naming log files. Example:'20140820_151113'
 * @return {string} Current time in a custom string format
 */ 
function getTimeStamp() {
  // We pad each value so that sorted directory listings show the files in chronological order
  function pad(number){
    if (number < 10)
    {
      return '0' + number;
    }

    return number;
  }

  var now = new Date();
  return pad(now.getFullYear()) 
    + pad(now.getMonth() + 1) 
    + pad(now.getDate())
    + "_" 
    + pad(now.getHours()) 
    + pad(now.getMinutes()) 
    + pad(now.getSeconds());
}

//provides the log directory where the logs would reside 
function getLogDir() {
  if(!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
  }
  return logDir;
};

//provides the log file path where logs would be stored
function getLogFilePath() {
  if (!currentLogFile) {
    let filename = `validate_log_${getTimeStamp()}.log`;
    currentLogFile = path.join(getLogDir(), filename);
  }

  return currentLogFile;
}

Object.defineProperty(logger, 'consoleLogLevel', {
  get: function() { return this.transports.console.level; },
  set: function(level) { 
    if (!level) {
      level = 'warn';
    }
    let validLevels = ['error', 'warn', 'info' , 'verbose', 'debug', 'silly'];
    if (!validLevels.some(function(item) { return item === level; })) {
      throw new Error(`The logging level provided is "${level}". Valid values are: "${validLevels}".`);
    }
    this.transports.console.level = level;
    return;
  }
});

module.exports = logger;