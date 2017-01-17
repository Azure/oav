// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var winston = require('winston'),
  path = require('path'),
  fs = require('fs'),
  utils = require('./utils'),
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
    let filename = `validate_log_${utils.getTimeStamp()}.log`;
    currentLogFile = path.join(getLogDir(), filename);
  }

  return currentLogFile;
}

module.exports = logger;