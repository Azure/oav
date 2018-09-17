// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as fs from "fs"
import * as pathlib from "path"
import { log } from "./util/logging"
import { MutableStringMap, keys } from "@ts-common/string-map"
import * as _ from "@ts-common/iterator"
import swaggerParser from "swagger-parser"

interface Options {
  output?: string
  shouldResolveXmsExamples?: unknown
  matchApiVersion?: unknown
}

/**
 * @class
 */
export class XMsExampleExtractor {
  private readonly specPath: string
  private readonly recordings: string
  private readonly options: Options
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
   * @param {object} [options.matchApiVersion] Only generate examples if api-version matches.
   * Default: false
   *
   * @param {object} [options.output] Output folder for the generated examples.
   */
  public constructor(
    specPath: string,
    recordings: string,
    options: Options
  ) {
    if (specPath === null
      || specPath === undefined
      || typeof specPath.valueOf() !== "string"
      || !specPath.trim().length) {
      throw new Error(
        "specPath is a required property of type string and it cannot be an empty string.")
    }

    if (recordings === null
      || recordings === undefined
      || typeof recordings.valueOf() !== "string"
      || !recordings.trim().length) {
      throw new Error(
        "recordings is a required property of type string and it cannot be an empty string.")
    }

    this.specPath = specPath
    this.recordings = recordings
    if (!options) { options = {} }
    if (options.output === null || options.output === undefined) {
      options.output = process.cwd() + "/output"
    }
    if (options.shouldResolveXmsExamples === null
      || options.shouldResolveXmsExamples === undefined) {
      options.shouldResolveXmsExamples = true
    }
    if (options.matchApiVersion === null || options.matchApiVersion === undefined) {
      options.matchApiVersion = false
    }

    this.options = options
    log.debug(`specPath : ${this.specPath}`)
    log.debug(`recordings : ${this.recordings}`)
    log.debug(`options.output : ${this.options.output}`)
    log.debug(`options.matchApiVersion : ${this.options.matchApiVersion}`)
  }

  public extractOne(
    relativeExamplesPath: string,
    outputExamples: string,
    api: any,
    recordingFileName: string
  ) {
    const recording = JSON.parse(fs.readFileSync(recordingFileName).toString())
    const paths = api.paths
    let pathIndex = 0
    let pathParams: MutableStringMap<number> = {}
    for (const path of keys(paths)) {
      pathIndex++
      const searchResult = path.match(/\/{\w*\}/g)
      const pathParts = path.split("/")
      let pathToMatch = path
      pathParams = {}
      if (searchResult !== null) {
      for (const match of searchResult) {
          const splitRegEx = /[{}]/
          const pathParam = match.split(splitRegEx)[1]

          for (const [part, value] of _.entries(pathParts)) {
            const pathPart = "/" + value
            if (pathPart.localeCompare(match) === 0) {
              pathParams[pathParam] = part
            }
          }
          pathToMatch = pathToMatch.replace(match, "/[^\/]+")
        }
      }
      let newPathToMatch = pathToMatch.replace(/\//g, "\\/")
      newPathToMatch = newPathToMatch + "$"

      // for this API path (and method), try to find it in the recording file, and get
      // the data
      const entries = recording.Entries
      let entryIndex = 0
      const queryParams: MutableStringMap<unknown> = {}
      for (const entry of keys(entries)) {
        entryIndex++
        let recordingPath = JSON.stringify(entries[entry].RequestUri)
        const recordingPathQueryParams = recordingPath.split("?")[1].slice(0, -1)
        const queryParamsArray = recordingPathQueryParams.split("&")
        for (const value of queryParamsArray) {
          const queryParam = value.split("=")
          queryParams[queryParam[0]] = queryParam[1]
        }

        const headerParams = entries[entry].RequestHeaders

        // if commandline included check for API version, validate api-version from URI in
        // recordings matches the api-version of the spec
        if (!this.options.matchApiVersion
          || (("api-version" in queryParams)
            && queryParams["api-version"] === api.info.version)) {
          recordingPath = recordingPath.replace(/\?.*/, "")
          const recordingPathParts = recordingPath.split("/")
          const match = recordingPath.match(newPathToMatch)
          if (match !== null) {
            log.silly("path: " + path)
            log.silly("recording path: " + recordingPath)

            const pathParamsValues: MutableStringMap<unknown> = {}
            for (const [p, v] of entries(pathParams)) {
              const index = v
              pathParamsValues[p] = recordingPathParts[index as number]
            }

            // found a match in the recording
            const requestMethodFromRecording = entries[entry].RequestMethod
            const infoFromOperation = paths[path][requestMethodFromRecording.toLowerCase()]
            if (typeof infoFromOperation !== "undefined") {
              // need to consider each method in operation
              const fileNameArray = recordingFileName.split("/")
              let fileName = fileNameArray[fileNameArray.length - 1]
              fileName = fileName.split(".json")[0]
              fileName = fileName.replace(/\//g, "-")
              const exampleFileName = fileName
                + "-"
                + requestMethodFromRecording
                + "-example-"
                + pathIndex
                + entryIndex
                + ".json"
              const ref = {
                $ref: relativeExamplesPath + exampleFileName
              }
              const exampleFriendlyName =
                fileName + requestMethodFromRecording + pathIndex + entryIndex
              log.debug(`exampleFriendlyName: ${exampleFriendlyName}`)

              if (!("x-ms-examples" in infoFromOperation)) {
                infoFromOperation["x-ms-examples"] = {}
              }
              infoFromOperation["x-ms-examples"][exampleFriendlyName] = ref
              const exampleL: {
                parameters: MutableStringMap<unknown>
                responses: MutableStringMap<{
                  body?: unknown
                }>
              } = {
                parameters: {},
                responses: {}
              }
              const params = infoFromOperation.parameters
              for (const [param, v] of entries(pathParamsValues)) {
                exampleL.parameters[param] = v
              }
              for (const [param, v] of entries(queryParams)) {
                exampleL.parameters[param] = v
              }
              for (const [param, v] of entries(headerParams)) {
                exampleL.parameters[param] = v
              }
              for (const param of keys(infoFromOperation.parameters)) {
                if (params[param].in === "body") {
                  const bodyParamName = params[param].name
                  const bodyParamValue = entries[entry].RequestBody
                  const bodyParamExample: MutableStringMap<unknown> = {}
                  bodyParamExample[bodyParamName] = bodyParamValue

                  exampleL.parameters[bodyParamName] = bodyParamValue !== "" ?
                    JSON.parse(bodyParamValue) :
                    ""
                }
              }
              for (const {} of keys(infoFromOperation.responses)) {
                const statusCodeFromRecording = entries[entry].StatusCode
                const responseBody = entries[entry].ResponseBody
                exampleL.responses[statusCodeFromRecording] = {
                  body: responseBody !== "" ? JSON.parse(responseBody) : ""
                }
              }
              log.info(`Writing x-ms-examples at ${outputExamples + exampleFileName}`)
              fs.writeFileSync(
                outputExamples + exampleFileName,
                JSON.stringify(exampleL, null, 2)
              )
            }
          }
        }
      }
    }
  }

  /**
   * Extracts x-ms-examples from the recordings
   */
  public async extract(): Promise<void> {
    if (this.options.output === undefined) {
      throw new Error("this.options.output === undefined")
    }
    this.mkdirSync(this.options.output)
    this.mkdirSync(this.options.output + "/examples")
    this.mkdirSync(this.options.output + "/swagger")

    const outputExamples = this.options.output + "/examples/"
    const relativeExamplesPath = "../examples/"
    const specName = this.specPath.split("/")
    const outputSwagger =
      this.options.output + "/swagger/" + specName[specName.length - 1].split(".")[0] + ".json"

    // const swaggerObject = JSON.parse(fs.readFileSync(this.specPath).toString())

    const accErrors: MutableStringMap<unknown> = {}
    const filesArray: string[] = []
    this.getFileList(this.recordings, filesArray)

    const recordingFiles = filesArray

    try {
      const api = await swaggerParser.parse(this.specPath)
      for (const recordingFileName of recordingFiles) {
        log.debug(`Processing recording file: ${recordingFileName}`)

        try {
          this.extractOne(relativeExamplesPath, outputExamples, api, recordingFileName)
          log.info(`Writing updated swagger with x-ms-examples at ${outputSwagger}`)
          fs.writeFileSync(outputSwagger, JSON.stringify(api, null, 2))
        } catch (err) {
          accErrors[recordingFileName] = err.toString()
          log.warn(`Error processing recording file: "${recordingFileName}"`)
          log.warn(`Error: "${err.toString()} "`)
        }
      }

      if (JSON.stringify(accErrors) !== "{}") {
        log.error(`Errors loading/parsing recording files.`)
        log.error(`${JSON.stringify(accErrors)}`)
      }
    } catch (err) {
      process.exitCode = 1
      log.error(err)
    }
  }

  private mkdirSync(path: string): void {
    try {
      fs.mkdirSync(path)
    } catch (e) {
      if (e.code !== "EEXIST") { throw e }
    }
  }

  private getFileList(dir: string, fileList: string[]): string[] {
    const files = fs.readdirSync(dir)
    fileList = fileList || []
    files.forEach(file => {
      if (fs.statSync(pathlib.join(dir, file)).isDirectory()) {
        fileList = this.getFileList(pathlib.join(dir, file), fileList)
      } else {
        fileList.push(pathlib.join(dir, file))
      }
    });
    return fileList
  }
}
