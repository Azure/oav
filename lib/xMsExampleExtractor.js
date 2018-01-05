// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var util = require('util'),
  fs = require('fs'),
  pathlib = require('path'),
  recursive = require('recursive-readdir'),
  utils = require('./util/utils'),
  log = require('./util/logging');

/**
 * @class
 */
class xMsExampleExtractor {
  /**
   * @constructor
   * Initializes a new instance of the xMsExampleExtractor class.
   * 
   * @param {string} specPath the swagger spec path
   * 
   * @param {object} recordings the folder for recordings
   * 
   * @param {object} [options] The options object
   * 
   * @param {object} [options.matchApiVersion] Only generate examples if api-version matches. Default: false
   * 
   * @param {object} [options.output] Output folder for the generated examples.
   */
  constructor(specPath, recordings, options) {
    if (specPath === null || specPath === undefined || typeof specPath.valueOf() !== 'string' || !specPath.trim().length) {
      throw new Error('specPath is a required property of type string and it cannot be an empty string.')
    }

    if (recordings === null || recordings === undefined || typeof recordings.valueOf() !== 'string' || !recordings.trim().length) {
      throw new Error('recordings is a required property of type string and it cannot be an empty string.')
    }

    this.specPath = specPath;
    this.recordings = recordings;
    this.specDir = pathlib.dirname(this.specPath);
    if (!options) options = {};
    if (options.output === null || options.output === undefined) {
      options.output = process.cwd() + '/output';
    }
    if (options.shouldResolveXmsExamples === null || options.shouldResolveXmsExamples === undefined) {
      options.shouldResolveXmsExamples = true;
    }
    if (options.matchApiVersion === null || options.matchApiVersion === undefined) {
      options.matchApiVersion = false;
    }

    this.options = options;
    log.debug(`specPath : ${this.specPath}`);
    log.debug(`recordings : ${this.recordings}`);
    log.debug(`options.output : ${this.options.output}`);
    log.debug(`options.matchApiVersion : ${this.options.matchApiVersion}`);
  }

  /**
   * Extracts x-ms-examples from the recordings
   */
  extract() {
    let self = this;
    self.mkdirSync(self.options.output);
    self.mkdirSync(self.options.output + "/examples");
    self.mkdirSync(self.options.output + "/swagger");

    let outputExamples = self.options.output + "/examples/";
    let relativeExamplesPath = "../examples/";
    let specName = self.specPath.split(/[/\\]/);
    let outputSwagger = self.options.output + "/swagger/" + specName[specName.length - 1].split(".")[0] + ".json"

    var swaggerObject = require(self.specPath);
    var SwaggerParser = require('swagger-parser');
    var parser = new SwaggerParser();

    var accErrors = {};
    var filesArray = [];
    self.getFileList(self.recordings, filesArray);

    let recordingFiles = filesArray;
    var example = {};

    parser.parse(swaggerObject).then(function (api) {
      for (var recordingFile in recordingFiles) {
        let recordingFileName = recordingFiles[recordingFile];
        log.debug(`Processing recording file: ${recordingFileName}`);

        try {
          let recording = JSON.parse(fs.readFileSync(recordingFileName));
          let paths = api.paths;
          let pathIndex = 0;
          var pathParams = {};
          for (var path in paths) {
            pathIndex++;
            let searchResult = path.match(/\/{\w*\}/g);
            let pathParts = path.split('/');
            let pathToMatch = path;
            pathParams = {};
            for (var sr in searchResult) {
              let match = searchResult[sr];
              let splitRegEx = /[{}]/;
              let pathParam = match.split(splitRegEx)[1];

              for (var part in pathParts) {
                let pathPart = "/" + pathParts[part];
                if (pathPart.localeCompare(match) == 0) {
                  pathParams[pathParam] = part;
                }
              }
              pathToMatch = pathToMatch.replace(match, "/[^\/]+");
            }
            let newPathToMatch = pathToMatch.replace(/\//g, "\\/");
            newPathToMatch = newPathToMatch + "$";

            //for this API path (and method), try to find it in the recording file, and get the data
            var entries = recording.Entries;
            let entryIndex = 0;
            let queryParams = {};
            for (var entry in entries) {
              entryIndex++;
              let recordingPath = JSON.stringify(entries[entry]["RequestUri"]);
              let recordingPathQueryParams = recordingPath.split('?')[1].slice(0, -1);
              let queryParamsArray = recordingPathQueryParams.split('&');
              for (var part in queryParamsArray) {
                let queryParam = queryParamsArray[part].split('=');
                queryParams[queryParam[0]] = queryParam[1];
              }

              // if commandline included check for API version, validate api-version from URI in recordings matches the api-version of the spec
              if (!self.options.matchApiVersion || (("api-version" in queryParams) && queryParams["api-version"] == api.info.version)) {
                recordingPath = recordingPath.replace(/\?.*/, '');
                let recordingPathParts = recordingPath.split('/');
                let match = recordingPath.match(newPathToMatch);
                if (match != null) {
                  log.silly("path: " + path);
                  log.silly("recording path: " + recordingPath);

                  var pathParamsValues = {};
                  for (var p in pathParams) {
                    let index = pathParams[p];
                    pathParamsValues[p] = recordingPathParts[index];
                  }

                  //found a match in the recording
                  let requestMethodFromRecording = entries[entry]["RequestMethod"];
                  let infoFromOperation = paths[path][requestMethodFromRecording.toLowerCase()];
                  if (typeof infoFromOperation != 'undefined') {
                    //need to consider each method in operation
                    let fileName = recordingFileName.split(/[/\\]/);
                    fileName = fileName[fileName.length - 1];
                    fileName = fileName.split(".json")[0];
                    fileName = fileName.replace(/\//g, "-");
                    let exampleFileName = fileName + "-" + requestMethodFromRecording + "-example-" + pathIndex + entryIndex + ".json";
                    let ref = {};
                    ref["$ref"] = relativeExamplesPath + exampleFileName;
                    let exampleFriendlyName = fileName + requestMethodFromRecording + pathIndex + entryIndex;
                    log.debug(`exampleFriendlyName: ${exampleFriendlyName}`);

                    if (!("x-ms-examples" in infoFromOperation)) {
                      infoFromOperation["x-ms-examples"] = {};
                    }
                    infoFromOperation["x-ms-examples"][exampleFriendlyName] = ref;
                    let example = {};
                    example["parameters"] = {};
                    example["responses"] = {};
                    let params = infoFromOperation["parameters"];
                    for (var param in pathParamsValues) {
                      example['parameters'][param] = pathParamsValues[param];
                    }
                    for (var param in queryParams) {
                      example['parameters'][param] = queryParams[param];
                    }
                    for (var param in infoFromOperation["parameters"]) {
                      if (params[param]["in"] == "body") {
                        let bodyParamName = params[param]["name"];
                        let bodyParamValue = entries[entry]["RequestBody"];
                        let bodyParamExample = {};
                        bodyParamExample[bodyParamName] = bodyParamValue;

                        if (bodyParamValue != "") {
                          example['parameters'][bodyParamName] = JSON.parse(bodyParamValue);
                        }
                        else {
                          example['parameters'][bodyParamName] = "";
                        }
                      }
                    }
                    let responses = infoFromOperation["responses"];
                    for (var response in responses) {
                      let statusCodeFromRecording = entries[entry]["StatusCode"];
                      let responseBody = entries[entry]["ResponseBody"];
                      example['responses'][statusCodeFromRecording] = {};
                      if (responseBody != "") {
                        example['responses'][statusCodeFromRecording]['body'] = JSON.parse(responseBody);
                      }
                      else {
                        example['responses'][statusCodeFromRecording]['body'] = "";
                      }
                    }
                    log.info(`Writing x-ms-examples at ${outputExamples + exampleFileName}`);
                    fs.writeFile(outputExamples + exampleFileName, JSON.stringify(example, null, 2));
                  }
                }
              }
            }
          }
          log.info(`Writing updated swagger with x-ms-examples at ${outputSwagger}`);
          fs.writeFile(outputSwagger, JSON.stringify(swaggerObject, null, 2));
        }
        catch (err) {
          accErrors[recordingFileName] = err.toString();
          log.warn(`Error pricessing recording file: "${recordingFileName}"`);
          log.warn(`Error: "${err.toString()} "`);
        }
      }

      if (JSON.stringify(accErrors) != "{}") {
        log.error(`Errors loading/parsing recording files.`);
        log.error(`${JSON.stringify(accErrors)}`);
      }
    }).catch(function (err) {
      process.exitCode = 1;
      log.error(err);
    });
  }

  mkdirSync(path) {
    try {
      fs.mkdirSync(path);
    } catch (e) {
      if (e.code != 'EEXIST') throw e;
    }
  }

  getFileList(dir, filelist) {
    let self = this;
    var files = fs.readdirSync(dir);
    filelist = filelist || [];
    files.forEach(function (file) {
      if (fs.statSync(pathlib.join(dir, file)).isDirectory()) {
        filelist = self.getFileList(pathlib.join(dir, file), filelist);
      }
      else {
        filelist.push(pathlib.join(dir, file));
      }
    });
    return filelist;
  }
}

module.exports = xMsExampleExtractor;
