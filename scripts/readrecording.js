
const util = require('util')
var fs = require('fs');
var glob = require('glob');
var pathlib = require('path');
var recursive = require('recursive-readdir')

var outputFolderName = ""
var swaggerSpecPath = ""
var pathToRecordings = ""
var outputExamples = ""
var outputSwagger = ""
var relativeExamplesPath = "../examples/"


exports.printUsage = function printUsage() {

  console.log('\nUsage: node readrecording.js spec <local file-path to the swagger spec> recordings <local folder-path to the .Net test recordings> output <local folder-path to store output swagger and examples> [--matchApiVersion]\n');
  console.log('Example: node readrecording.js spec "./arm-network/network.json" recordings "arm-network/SessionRecords/" output "arm-network"\n')
  console.log('If examples should only be generated from recordings that match the api version of the spec, please include \'--matchApiVersion\' as the last option. \n')
  process.exit(1);
}
var cmdSpec = process.argv[2];

if ((typeof cmdSpec == 'undefined') || cmdSpec === '-h' || cmdSpec === '--help' || cmdSpec === 'help') {
  exports.printUsage();
}

var cmdSpecPath = process.argv[3];
var cmdRecordings = process.argv[4];
var cmdRecordingPath = process.argv[5];
var cmdOutput = process.argv[6];
var cmdOutputPath = process.argv[7];
var checkAPIVersion = process.argv[8]

if (cmdSpec !== 'spec' || cmdRecordings !== 'recordings' || cmdOutput !== 'output' || (typeof cmdOutputPath == 'undefined')) {
  exports.printUsage();
}

checkAPIVersion = (checkAPIVersion === '--matchApiVersion')

swaggerSpecPath = cmdSpecPath
pathToRecordings = cmdRecordingPath
outputFolderName = cmdOutputPath

var mkdirSync = function (path) {
  try {
    fs.mkdirSync(path);
  } catch (e) {
    if (e.code != 'EEXIST') throw e;
  }
}

mkdirSync(cmdOutputPath);
mkdirSync(cmdOutputPath + "/examples");
mkdirSync(cmdOutputPath + "/swagger");

outputExamples = outputFolderName + "/examples/"
relativeExamplesPath = "../examples/"
specName = swaggerSpecPath.split("/")
outputSwagger = outputFolderName + "/swagger/" + specName[specName.length - 1].split(".")[0] + ".json"

var swaggerObject = require(swaggerSpecPath)

var SwaggerParser = require('swagger-parser')
var parser = new SwaggerParser()

var example = {};
example['parameters'] = {}
example['responses'] = {}

var accErrors = {}

var getFileList = function (dir, filelist) {
  var files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function (file) {
    if (fs.statSync(pathlib.join(dir, file)).isDirectory()) {
      filelist = getFileList(pathlib.join(dir, file), filelist);
    }
    else {
      filelist.push(pathlib.join(dir, file));
    }
  });
  return filelist;
};
var filesArray = []
getFileList(pathToRecordings, filesArray)

recordingFiles = filesArray

var example = {};
parser.parse(swaggerObject)
  .then(function (api) {
    console.log("API name: " + api.info.title)
    specApiVersion = api.info.version
    paths = api.paths

    for (var recordingFile in recordingFiles) {
      console.log("*****************")
      console.log("Recording file: " + recordingFiles[recordingFile])
      recordingFileName = recordingFiles[recordingFile]
      try {
        var recording = JSON.parse(fs.readFileSync(recordingFileName));

        pathIndex = 0
        var pathParams = {}
        for (var path in paths) {
          pathIndex++;
          searchResult = path.match(/\/{\w*\}/g)
          pathParts = path.split('/')
          pathToMatch = path
          pathParams = {}
          for (var sr in searchResult) {
            match = searchResult[sr]
            splitRegEx = /[{}]/
            pathParam = match.split(splitRegEx)[1]

            for (var part in pathParts) {
              pathPart = "/" + pathParts[part]
              if (pathPart.localeCompare(match) == 0) {
                pathParams[pathParam] = part
              }
            }
            pathToMatch = pathToMatch.replace(match, "/[^\/]+");
          }
          newPathToMatch = pathToMatch.replace(/\//g, "\\/");
          newPathToMatch = newPathToMatch + "$"

          //for this API path (and method), try to find it in the recording file, and get the data
          var entries = recording.Entries
          entryIndex = 0
          queryParams = {}
          for (var entry in entries) {
            entryIndex++;
            recordingPath = JSON.stringify(entries[entry]["RequestUri"]);
            recordingPathQueryParams = recordingPath.split('?')[1].slice(0, -1)
            queryParamsArray = recordingPathQueryParams.split('&')
            for (var part in queryParamsArray) {
              queryParam = queryParamsArray[part].split('=')
              queryParams[queryParam[0]] = queryParam[1]
            }

            // if commandline included check for API version, validate api-version from URI in recordings matches the api-version of the spec
            if (!checkAPIVersion || (("api-version" in queryParams) && queryParams["api-version"] == specApiVersion)) {
              recordingPath = recordingPath.replace(/\?.*/, '')
              recordingPathParts = recordingPath.split('/')
              match = recordingPath.match(newPathToMatch)
              if (match != null) {
                console.log("path: " + path)
                console.log("recording path: " + recordingPath)

                var pathParamsValues = {}
                for (var p in pathParams) {
                  index = pathParams[p]
                  pathParamsValues[p] = recordingPathParts[index]
                }

                //found a match in the recording
                requestMethodFromRecording = entries[entry]["RequestMethod"]
                infoFromOperation = paths[path][requestMethodFromRecording.toLowerCase()]
                if (typeof infoFromOperation != 'undefined') {
                  //need to consider each method in operation
                  fileName = recordingFileName.split('/')
                  fileName = fileName[fileName.length - 1]
                  fileName = fileName.split(".json")[0]
                  fileName = fileName.replace(/\//g, "-")
                  exampleFileName = fileName + "-" + requestMethodFromRecording + "-example-" + pathIndex + entryIndex + ".json";
                  ref = {}
                  ref["$ref"] = relativeExamplesPath + exampleFileName
                  exampleFriendlyName = fileName + requestMethodFromRecording + pathIndex + entryIndex
                  console.log(exampleFriendlyName)
                  if (!("x-ms-examples" in infoFromOperation)) {
                    infoFromOperation["x-ms-examples"] = {}
                  }
                  infoFromOperation["x-ms-examples"][fileName + requestMethodFromRecording + pathIndex + entryIndex] = ref
                  example = {};
                  example["parameters"] = {}
                  example["responses"] = {}
                  params = infoFromOperation["parameters"]
                  for (var param in pathParamsValues) {
                    example['parameters'][param] = pathParamsValues[param]
                  }
                  for (var param in queryParams) {
                    example['parameters'][param] = queryParams[param]
                  }
                  for (var param in infoFromOperation["parameters"]) {
                    if (params[param]["in"] == "body") {

                      bodyParamName = params[param]["name"]
                      bodyParamValue = entries[entry]["RequestBody"]
                      bodyParamExample = {};
                      bodyParamExample[bodyParamName] = bodyParamValue

                      if (bodyParamValue != "") {
                        example['parameters'][bodyParamName] = JSON.parse(bodyParamValue)
                      }
                      else {
                        example['parameters'][bodyParamName] = ""
                      }
                    }
                  }
                  responses = infoFromOperation["responses"]
                  for (var response in responses) {
                    statusCodeFromRecording = entries[entry]["StatusCode"]
                    responseBody = entries[entry]["ResponseBody"]
                    example['responses'][statusCodeFromRecording] = {}
                    if (responseBody != "") {
                      example['responses'][statusCodeFromRecording]['body'] = JSON.parse(responseBody)
                    }
                    else {
                      example['responses'][statusCodeFromRecording]['body'] = ""
                    }

                  }
                  fs.writeFile(outputExamples + exampleFileName, JSON.stringify(example, null, 2))
                }
              }
            }
          }
        }
        fs.writeFile(outputSwagger, JSON.stringify(swaggerObject, null, 2))
      }
      catch (err) {
        accErrors[recordingFileName] = err.toString()
      }
    }
    if (JSON.stringify(accErrors) != "{}") {
      console.log()
      console.log("---> Errors loading/parsing recording files:")
      console.log(JSON.stringify(accErrors))
    }
  })
  .catch(function (err) {
    console.error(err)
      ;
  })




