// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var util = require('util'),
  fs = require('fs'),
  pathlib = require('path'),
  recursive = require('recursive-readdir'),
  JsonRefs = require('json-refs'),
  utils = require('./util/utils'),
  Constants = require('./util/constants'),
  log = require('./util/logging'),
  ErrorCodes = Constants.ErrorCodes;

/**
 * @class
 */
class XMsExampleGenerator {

  /**
   * @constructor
   * Initializes a new instance of the SpecResolver class.
   * 
   * @param {string} specPath the (remote|local) swagger spec path
   * 
   * @param {object} recordings the parsed spec in json format
   * 
   * @param {object} [options] The options object
   * 
   * @param {object} [options.matchApiVersion] Should relative pathes be resolved? Default: true
   * 
   * @param {object} [options.output] Should x-ms-examples be resolved? Default: true. 
   * If options.shouldResolveRelativePaths is false then this option will also be false implicitly and cannot be overridden.
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
      options.output = pathlib.dirname(this.specPath);
    }
    if (options.shouldResolveXmsExamples === null || options.shouldResolveXmsExamples === undefined) {
      options.shouldResolveXmsExamples = true;
    }
    if (options.matchApiVersion === null || options.matchApiVersion === undefined) {
      options.matchApiVersion = false;
    }

    this.options = options;
  }

  /**
   */
  generate() {
    let self = this;
    self.mkdirSync(self.options.output);
    self.mkdirSync(self.options.output + "/examples");
    self.mkdirSync(self.options.output + "/swagger");

    let outputExamples = self.options.output + "/examples/";
    let relativeExamplesPath = "../examples/";
    let specName = self.specPath.split("/");
    let outputSwagger = self.options.output + "/swagger/" + specName[specName.length - 1].split(".")[0] + ".json";

    var swaggerObject = require(self.specPath);
    var SwaggerParser = require('swagger-parser');
    var parser = new SwaggerParser();

    var example = {};
    example['parameters'] = {};
    example['responses'] = {};

    var accErrors = {};
    var filesArray = [];
    self.getFileList(self.recordings, filesArray);

    let recordingFiles = filesArray;
    var example = {};

    parser.parse(swaggerObject).then(function (api) {
      console.log("API name: " + api.info.title);
      let specApiVersion = api.info.version;
      let paths = api.paths;

      for (var recordingFile in recordingFiles) {
        console.log("*****************");
        console.log("Recording file: " + recordingFiles[recordingFile]);
        let recordingFileName = recordingFiles[recordingFile];
        try {
          var recording = JSON.parse(fs.readFileSync(recordingFileName));

          let pathIndex = 0;
          var pathParams = {}
          for (var path in paths) {
            pathIndex++;
            searchResult = path.match(/\/{\w*\}/g);
            pathParts = path.split('/');
            pathToMatch = path;
            pathParams = {};
            for (var sr in searchResult) {
              match = searchResult[sr];
              splitRegEx = /[{}]/;
              pathParam = match.split(splitRegEx)[1];

              for (var part in pathParts) {
                pathPart = "/" + pathParts[part];
                if (pathPart.localeCompare(match) == 0) {
                  pathParams[pathParam] = part;
                }
              }
              pathToMatch = pathToMatch.replace(match, "/[^\/]+");
            }
            newPathToMatch = pathToMatch.replace(/\//g, "\\/");
            newPathToMatch = newPathToMatch + "$";

            //for this API path (and method), try to find it in the recording file, and get the data
            var entries = recording.Entries;
            entryIndex = 0;
            queryParams = {};
            for (var entry in entries) {
              entryIndex++;
              recordingPath = JSON.stringify(entries[entry]["RequestUri"]);
              recordingPathQueryParams = recordingPath.split('?')[1].slice(0, -1);
              queryParamsArray = recordingPathQueryParams.split('&');
              for (var part in queryParamsArray) {
                queryParam = queryParamsArray[part].split('=');
                queryParams[queryParam[0]] = queryParam[1];
              }

              // if commandline included check for API version, validate api-version from URI in recordings matches the api-version of the spec
              if (!checkAPIVersion || (("api-version" in queryParams) && queryParams["api-version"] == specApiVersion)) {
                recordingPath = recordingPath.replace(/\?.*/, '');
                recordingPathParts = recordingPath.split('/');
                match = recordingPath.match(newPathToMatch);
                if (match != null) {
                  console.log("path: " + path);
                  console.log("recording path: " + recordingPath);

                  var pathParamsValues = {}
                  for (var p in pathParams) {
                    index = pathParams[p];
                    pathParamsValues[p] = recordingPathParts[index];
                  }

                  //found a match in the recording
                  requestMethodFromRecording = entries[entry]["RequestMethod"];
                  infoFromOperation = paths[path][requestMethodFromRecording.toLowerCase()];
                  if (typeof infoFromOperation != 'undefined') {
                    //need to consider each method in operation
                    fileName = recordingFileName.split('/');
                    fileName = fileName[fileName.length - 1];
                    fileName = fileName.split(".json")[0];
                    fileName = fileName.replace(/\//g, "-");
                    exampleFileName = fileName + "-" + requestMethodFromRecording + "-example-" + pathIndex + entryIndex + ".json";
                    ref = {};
                    ref["$ref"] = relativeExamplesPath + exampleFileName;
                    exampleFriendlyName = fileName + requestMethodFromRecording + pathIndex + entryIndex;
                    console.log(exampleFriendlyName)
                    if (!("x-ms-examples" in infoFromOperation)) {
                      infoFromOperation["x-ms-examples"] = {};
                    }
                    infoFromOperation["x-ms-examples"][fileName + requestMethodFromRecording + pathIndex + entryIndex] = ref;
                    example = {};
                    example["parameters"] = {};
                    example["responses"] = {};
                    params = infoFromOperation["parameters"];
                    for (var param in pathParamsValues) {
                      example['parameters'][param] = pathParamsValues[param];
                    }
                    for (var param in queryParams) {
                      example['parameters'][param] = queryParams[param];
                    }
                    for (var param in infoFromOperation["parameters"]) {
                      if (params[param]["in"] == "body") {

                        bodyParamName = params[param]["name"];
                        bodyParamValue = entries[entry]["RequestBody"];
                        bodyParamExample = {};
                        bodyParamExample[bodyParamName] = bodyParamValue;

                        if (bodyParamValue != "") {
                          example['parameters'][bodyParamName] = JSON.parse(bodyParamValue);
                        }
                        else {
                          example['parameters'][bodyParamName] = "";
                        }
                      }
                    }
                    responses = infoFromOperation["responses"];
                    for (var response in responses) {
                      statusCodeFromRecording = entries[entry]["StatusCode"];
                      responseBody = entries[entry]["ResponseBody"];
                      example['responses'][statusCodeFromRecording] = {};
                      if (responseBody != "") {
                        example['responses'][statusCodeFromRecording]['body'] = JSON.parse(responseBody);
                      }
                      else {
                        example['responses'][statusCodeFromRecording]['body'] = "";
                      }

                    }
                    fs.writeFile(outputExamples + exampleFileName, JSON.stringify(example, null, 2));
                  }
                }
              }
            }
          }
          fs.writeFile(outputSwagger, JSON.stringify(swaggerObject, null, 2));
        }
        catch (err) {
          accErrors[recordingFileName] = err.toString();
        }
      }
      if (JSON.stringify(accErrors) != "{}") {
        console.log("---> Errors loading/parsing recording files:");
        console.log(JSON.stringify(accErrors));
      }
    }).catch(function (err) {
      console.error(err);
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

module.exports = XMsExampleGenerator;