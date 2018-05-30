// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as fs from 'fs'
import { execSync } from 'child_process'
import * as util from 'util'
import * as path from 'path'
import * as jsonPointer from 'json-pointer'
import * as YAML from 'js-yaml'
import { log } from './logging'
import request = require('request')
import * as lodash from 'lodash'
import * as http from 'http'

/*
 * Caches the json docs that were successfully parsed by parseJson(). This avoids, fetching them again.
 * key: docPath
 * value: parsed doc in JSON format
 */
export let docCache: any = {}

export function clearCache(): void {
  docCache = {}
  return
}

/*
 * Removes byte order marker. This catches EF BB BF (the UTF-8 BOM)
 * because the buffer-to-string conversion in `fs.readFile()`
 * translates it to FEFF, the UTF-16 BOM.
 */
export function stripBOM(content: any) {
  if (Buffer.isBuffer(content)) {
    content = content.toString()
  }
  if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
    content = content.slice(1)
  }
  return content
}

/*
 * Provides a parsed JSON from the given file path or a url.
 *
 * @param {string} specPath - A local file path or a (github) url to the swagger spec.
 * The method will auto convert a github url to rawgithub url.
 *
 * @returns {object} jsonDoc - Parsed document in JSON format.
 */
export function parseJson(specPath: string): Promise<any> {
  if (!specPath || (specPath && typeof specPath.valueOf() !== 'string')) {
    let err = new Error(
      'A (github) url or a local file path to the swagger spec is required and must be of type string.')
    return Promise.reject(err)
  }
  if (docCache[specPath]) {
    return Promise.resolve(docCache[specPath])
  }
  //url
  if (specPath.match(/^http.*/ig) !== null) {
    //If the spec path is a url starting with https://github then let us auto convert it to an https://raw.githubusercontent url.
    if (specPath.startsWith('https://github')) {
      specPath = specPath.replace(
        /^https:\/\/(github.com)(.*)blob\/(.*)/ig, 'https://raw.githubusercontent.com$2$3')
    }
    let res = makeRequest({ url: specPath, errorOnNon200Response: true })
    docCache[specPath] = res
    return res
  } else {
    //local filepath
    try {
      let fileContent = stripBOM(fs.readFileSync(specPath, 'utf8'))
      let result = parseContent(specPath, fileContent)
      docCache[specPath] = result
      return Promise.resolve(result)
    } catch (err) {
      let msg =
        `Unable to read the content or execute "JSON.parse()" on the content of file "${specPath}". The error is:\n${err}`
      let e: any = new Error(msg)
      log.error(e)
      return Promise.reject(e)
    }
  }
}

/*
 * Provides a parsed JSON from the given content.
 *
 * @param {string} filePath - A local file path or a (github) url to the swagger spec.
 *
 * @param {string} fileContent - The content to be parsed.
 *
 * @returns {object} jsonDoc - Parsed document in JSON format.
 */
export function parseContent(filePath: string, fileContent: string) {
  let result = null
  if (/.*\.json$/ig.test(filePath)) {
    result = JSON.parse(fileContent)
  } else if (/.*\.ya?ml$/ig.test(filePath)) {
    result = YAML.safeLoad(fileContent)
  } else {
    let msg =
      `We currently support "*.json" and "*.yaml | *.yml" file formats for validating swaggers.\n` +
      `The current file extension in "${filePath}" is not supported.`
    throw new Error(msg)
  }
  return result
}

/*
 * A utility function to help us acheive stuff in the same way as async/await but with yield statement and generator functions.
 * It waits till the task is over.
 * @param {function} A generator function as an input
 */
export function run(genfun: () => any) {
  // instantiate the generator object
  let gen = genfun()
  // This is the async loop pattern
  function next(err?: any, answer?: any) {
    let res
    if (err) {
      // if err, throw it into the wormhole
      return gen.throw(err)
    } else {
      // if good value, send it
      res = gen.next(answer)
    }
    if (!res.done) {
      // if we are not at the end
      // we have an async request to
      // fulfill, we do this by calling
      // `value` as a function
      // and passing it a callback
      // that receives err, answer
      // for which we'll just use `next()`
      res.value(next)
    }
  }
  // Kick off the async loop
  next()
}

/*
 * Makes a generic request. It is a wrapper on top of request.js library that provides a promise instead of a callback.
 *
 * @param {object} options - The request options as described over here https://github.com/request/request#requestoptions-callback
 *
 * @param {boolean} options.errorOnNon200Response If true will reject the promise with an error if the response statuscode is not 200.
 *
 * @return {Promise} promise - A promise that resolves to the responseBody or rejects to an error.
 */
export function makeRequest(options: any) {
  var promise = new Promise(function (resolve, reject) {
    request(options, function (err: any, response: request.Response, responseBody: any): void {
      if (err) {
        reject(err)
      }
      if (options.errorOnNon200Response && response.statusCode !== 200) {
        var msg = `StatusCode: "${response.statusCode}", ResponseBody: "${responseBody}."`
        reject(new Error(msg))
      }
      let res = responseBody
      try {
        if (typeof responseBody.valueOf() === 'string') {
          res = parseContent(options.url, responseBody)
        }
      } catch (error) {
        let msg =
          `An error occurred while parsing the file ${options.url}. The error is:\n ${util.inspect(error, { depth: null })}.`
        let e = new Error(msg)
        reject(e)
      }

      resolve(res)
    })
  })
  return promise
}

/*
 * Executes an array of promises sequentially. Inspiration of this method is here:
 * https://pouchdb.com/2015/05/18/we-have-a-problem-with-promises.html. An awesome blog on promises!
 *
 * @param {Array} promiseFactories An array of promise factories(A function that return a promise)
 *
 * @return A chain of resolved or rejected promises
 */
export function executePromisesSequentially(promiseFactories: any[]): Promise<void> {
  let result = Promise.resolve()
  promiseFactories.forEach(function (promiseFactory) {
    result = result.then(promiseFactory)
  })
  return result
};

/*
 * Generates a randomId
 *
 * @param {string} [prefix] A prefix to which the random numbers will be appended.
 *
 * @param {object} [existingIds] An object of existingIds. The function will
 * ensure that the randomId is not one of the existing ones.
 *
 * @return {string} result A random string
 */
export function generateRandomId(prefix: string, existingIds: any): string {
  let randomStr
  while (true) {
    randomStr = Math.random().toString(36).substr(2, 12)
    if (prefix && typeof prefix.valueOf() === 'string') {
      randomStr = prefix + randomStr
    }
    if (!existingIds || !(randomStr in existingIds)) {
      break
    }
  }
  return randomStr
};

/*
 * Parses a [inline|relative] [model|parameter] reference in the swagger spec.
 * This method does not handle parsing paths "/subscriptions/{subscriptionId}/etc.".
 *
 * @param {string} reference Reference to be parsed.
 *
 * @return {object} result
 *         {string} [result.filePath] Filepath present in the reference. Examples are:
 *             - '../newtwork.json#/definitions/Resource' => '../network.json'
 *             - '../examples/nic_create.json' => '../examples/nic_create.json'
 *         {object} [result.localReference] Provides information about the local reference in the json document.
 *         {string} [result.localReference.value] The json reference value. Examples are:
 *           - '../newtwork.json#/definitions/Resource' => '#/definitions/Resource'
 *           - '#/parameters/SubscriptionId' => '#/parameters/SubscriptionId'
 *         {string} [result.localReference.accessorProperty] The json path expression that can be used by
 *         eval() to access the desired object. Examples are:
 *           - '../newtwork.json#/definitions/Resource' => 'definitions.Resource'
 *           - '#/parameters/SubscriptionId' => 'parameters,SubscriptionId'
 */
export function parseReferenceInSwagger(reference: string) {
  if (!reference || (reference && reference.trim().length === 0)) {
    throw new Error('reference cannot be null or undefined and it must be a non-empty string.')
  }

  let result: any = {}
  if (reference.includes('#')) {
    //local reference in the doc
    if (reference.startsWith('#/')) {
      result.localReference = {}
      result.localReference.value = reference
      result.localReference.accessorProperty = reference.slice(2).replace('/', '.')
    } else {
      //filePath+localReference
      let segments = reference.split('#')
      result.filePath = segments[0]
      result.localReference = {}
      result.localReference.value = '#' + segments[1]
      result.localReference.accessorProperty = segments[1].slice(1).replace('/', '.')
    }
  } else {
    //we are assuming that the string is a relative filePath
    result.filePath = reference
  }

  return result
}

/*
 * Same as path.join(), however, it converts backward slashes to forward slashes.
 * This is required because path.join() joins the paths and converts all the
 * forward slashes to backward slashes if executed on a windows system. This can
 * be problematic while joining a url. For example:
 * path.join('https://github.com/Azure/openapi-validation-tools/blob/master/lib', '../examples/foo.json') returns
 * 'https:\\github.com\\Azure\\openapi-validation-tools\\blob\\master\\examples\\foo.json' instead of
 * 'https://github.com/Azure/openapi-validation-tools/blob/master/examples/foo.json'
 *
 * @param variable number of arguments and all the arguments must be of type string. Similar to the API
 * provided by path.join() https://nodejs.org/dist/latest-v6.x/docs/api/path.html#path_path_join_paths
 * @return {string} resolved path
 */
export function joinPath(...args: string[]): string {
  let finalPath = path.join(...args)
  finalPath = finalPath.replace(/\\/gi, '/')
  finalPath = finalPath.replace(/^(http|https):\/(.*)/gi, '$1://$2')
  return finalPath
}

/*
 * Provides a parsed JSON from the given file path or a url. Same as parseJson(). However,
 * this method accepts variable number of path segments as strings and joins them together.
 * After joining the path, it internally calls parseJson().
 *
 * @param variable number of arguments and all the arguments must be of type string.
 *
 * @returns {object} jsonDoc - Parsed document in JSON format.
 */
export function parseJsonWithPathFragments(...args: string[]) {
  let specPath = joinPath(...args)
  return parseJson(specPath)
}

/*
 * Merges source object into the target object
 * @param {object} source The object that needs to be merged
 *
 * @param {object} target The object to be merged into
 *
 * @returns {object} target - Returns the merged target object.
 */
export function mergeObjects(source: any, target: any) {
  Object.keys(source).forEach(function (key) {
    if (Array.isArray(source[key])) {
      if (target[key] && !Array.isArray(target[key])) {
        throw new Error(`Cannot merge ${key} from source object into target object because the same property in target object is not (of the same type) an Array.`)
      }
      if (!target[key]) {
        target[key] = []
      }
      target[key] = mergeArrays(source[key], target[key])
    } else {
      target[key] = lodash.cloneDeep(source[key])
    }
  });
  return target
}

/*
 * Merges source array into the target array
 * @param {array} source The array that needs to be merged
 *
 * @param {array} target The array to be merged into
 *
 * @returns {array} target - Returns the merged target array.
 */
export function mergeArrays(source: any[], target: any[]) {
  if (!Array.isArray(target) || (!Array.isArray(source))) {
    return target
  }
  source.forEach((item) => {
    target.push(lodash.cloneDeep(item))
  })
  return target
};

/*
 * Gets the object from the given doc based on the provided json reference pointer.
 * It returns undefined if the location is not found in the doc.
 * @param {object} doc The source object.
 *
 * @param {string} ptr The json reference pointer
 *
 * @returns {any} result - Returns the value that the ptr points to, in the doc.
 */
export function getObject(doc: any, ptr: string) {
  let result
  try {
    result = jsonPointer.get(doc, ptr)
  } catch (err) {
    log.error(err)
    throw err
  }
  return result
}

/*
 * Sets the given value at the location provided by the ptr in the given doc.
 * @param {object} doc The source object.
 *
 * @param {string} ptr The json reference pointer.
 *
 * @param {any} value The value that needs to be set at the
 * location provided by the ptr in the doc.
 */
export function setObject(doc: any, ptr: string, value: any) {
  let result
  try {
    result = jsonPointer.set(doc, ptr, value)
  } catch (err) {
    log.error(err)
  }
  return result
}

/*
 * Removes the location pointed by the json pointer in the given doc.
 * @param {object} doc The source object.
 *
 * @param {string} ptr The json reference pointer.
 */
export function removeObject(doc: any, ptr: string) {
  let result
  try {
    result = jsonPointer.remove(doc, ptr)
  } catch (err) {
    log.error(err)
  }
  return result
}

/**
/*
 * Gets provider namespace from the given path. In case of multiple, last one will be returned.
 * @param {string} path The path of the operation.
 *                 Example "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/providers/{resourceProviderNamespace}/
 *                 {parentResourcePath}/{resourceType}/{resourceName}/providers/Microsoft.Authorization/roleAssignments"
 *                 will return "Microsoft.Authorization".
 *
 * @returns {string} result - provider namespace from the given path.
 */
export function getProvider(path?: string|null): string|undefined {
  if (path === null || path === undefined || typeof path.valueOf() !== 'string' || !path.trim().length) {
    throw new Error('path is a required parameter of type string and it cannot be an empty string.')
  }

  let providerRegEx = new RegExp('/providers/(\:?[^{/]+)', 'gi')
  let result
  let pathMatch

  // Loop over the paths to find the last matched provider namespace
  while ((pathMatch = providerRegEx.exec(path)) !== null) {
    result = pathMatch[1]
  }

  return result
}

/**
/*
 * Clones a github repository in the given directory.
 * @param {string} directory to where to clone the repository.
 *
 * @param {string} url of the repository to be cloned.
 *                 Example "https://github.com/Azure/azure-rest-api-specs.git" or
 *                         "git@github.com:Azure/azure-rest-api-specs.git".
 *
 * @param {string} [branch] to be cloned instead of the default branch.
 */
export function gitClone(directory: string, url: string, branch: string): void {
  if (url === null || url === undefined || typeof url.valueOf() !== 'string' || !url.trim().length) {
    throw new Error('url is a required parameter of type string and it cannot be an empty string.')
  }

  if (directory === null
    || directory === undefined
    || typeof directory.valueOf() !== 'string'
    || !directory.trim().length) {
    throw new Error('directory is a required parameter of type string and it cannot be an empty string.')
  }

  // If the directory exists then we assume that the repo to be cloned is already present.
  if (fs.existsSync(directory)) {
    if (fs.lstatSync(directory).isDirectory()) {
      try {
        removeDirSync(directory)
      } catch (err) {
        throw new Error(
          `An error occurred while deleting directory ${directory}: ${util.inspect(err, { depth: null })}.`)
      }
    } else {
      try {
        fs.unlinkSync(directory)
      } catch (err) {
        throw new Error(
          `An error occurred while deleting file ${directory}: ${util.inspect(err, { depth: null })}.`)
      }
    }
  }

  try {
    fs.mkdirSync(directory)
  } catch (err) {
    throw new Error(
      `An error occurred while creating directory ${directory}: ${util.inspect(err, { depth: null })}.`)
  }

  try {
    let isBranchDefined = branch !== null && branch !== undefined && typeof branch.valueOf() === 'string'
    let cmd = isBranchDefined
      ? `git clone --depth=1 --branch ${branch} ${url} ${directory}`
      : `git clone --depth=1 ${url} ${directory}`
    let result = execSync(cmd, { encoding: 'utf8' })
  } catch (err) {
    throw new Error(`An error occurred while cloning git repository: ${util.inspect(err, { depth: null })}.`)
  }
}

/*
 * Removes given directory recursively.
 * @param {string} dir directory to be deleted.
 */
export function removeDirSync(dir: string) {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(function (file: any) {
      var current = dir + '/' + file
      if (fs.statSync(current).isDirectory()) removeDirSync(current)
      else fs.unlinkSync(current)
    })
    fs.rmdirSync(dir)
  }
}

/*
 * Finds the first content-type that contains "/json". Only supported Content-Types are
 * "text/json" & "application/json" so we perform first best match that contains '/json'
 *
 * @param {array} consumesOrProduces Array of content-types.
 * @returns {string} firstMatchedJson content-type that contains "/json".
 */
export function getJsonContentType(consumesOrProduces: any[]) {
  let firstMatchedJson = null
  if (consumesOrProduces) {
    firstMatchedJson = consumesOrProduces.find((contentType) => {
      return (contentType.match(/.*\/json.*/ig) !== null)
    })
  }
  return firstMatchedJson
}

/**
 * Determines whether the given string is url encoded
 * @param {string} str - The input string to be verified.
 * @returns {boolean} result - true if str is url encoded; false otherwise.
 */
export function isUrlEncoded(str: string): boolean {
  str = str || ''
  return str !== decodeURIComponent(str)
}

/**
 * Determines whether the given model is a pure (free-form) object candidate (i.e. equivalent of the C# Object type).
 * @param {object} model - The model to be verified
 * @returns {boolean} result - true if model is a pure object; false otherwise.
 */
export function isPureObject(model: any): boolean {
  if (!model) {
    throw new Error(`model cannot be null or undefined and must be of type "object"`)
  }
  if (model.type
    && typeof model.type.valueOf() === 'string'
    && model.type === 'object'
    && model.properties
    && getKeys(model.properties).length === 0) {
    return true
  } else if (!model.type && model.properties && getKeys(model.properties).length === 0) {
    return true
  } else if (model.type
    && typeof model.type.valueOf() === 'string'
    && model.type === 'object'
    && !model.properties
    && !model.additionalProperties) {
    return true
  } else {
    return false
  }
}

/**
 * Relaxes/Transforms the given entities type from a specific JSON schema primitive type (http://json-schema.org/latest/json-schema-core.html#rfc.section.4.2)
 * to an array of JSON schema primitve types (http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.21).
 *
 * @param {object} entity - The entity to be relaxed.
 * @param {boolean|undefined} [isRequired] - A boolean value that indicates whether the entity is required or not.
 * If the entity is required then the primitve type "null" is not added.
 * @returns {object} entity - The transformed entity if it is a pure object else the same entity is returned as-is.
 */
export function relaxEntityType(entity: any, isRequired?: boolean) {
  if (isPureObject(entity) && entity.type) {
    delete entity.type
  }
  if (entity.additionalProperties
    && isPureObject(entity.additionalProperties)
    && entity.additionalProperties.type) {
    delete entity.additionalProperties.type
  }
  return entity
}

/**
 * Relaxes/Transforms model definition like entities recursively
 */
export function relaxModelLikeEntities(model: any) {
  model = relaxEntityType(model)
  if (model.properties) {
    let modelProperties = model.properties

    for (let propName of getKeys(modelProperties)) {
      if (modelProperties[propName].properties) {
        modelProperties[propName] = relaxModelLikeEntities(modelProperties[propName])
      } else {
        modelProperties[propName] = relaxEntityType(
          modelProperties[propName], isPropertyRequired(propName, model))
      }
    }
  }
  return model
}

/**
 * Relaxes the entity to be a oneOf: [the current type OR null type] if the condition is satisfied
 * @param {object} entity - The entity to be relaxed
 * @param {Boolean|undefined} isPropRequired - states whether the property is required.
 * If true then it is required. If false or undefined then it is not required.
 * @returns {object} entity - The processed entity
 */
export function allowNullType(entity: any, isPropRequired?: boolean) {
  // if entity has a type
  if (entity && entity.type) {
    // if type is an array
    if (entity.type === "array") {
      if (entity.items) {
        // if items object contains inline properties
        if (entity.items.properties) {
          entity.items = allowNullableTypes(entity.items)
        } else {
          entity.items = allowNullType(entity.items)
        }
      }
    }

    // takes care of string 'false' and 'true'
    if (typeof entity['x-nullable'] === 'string') {
      if (entity['x-nullable'].toLowerCase() === 'false') {
        entity['x-nullable'] = false
      } else if (entity['x-nullable'].toLowerCase() === 'true') {
        entity['x-nullable'] = true
      }
    }

    if (shouldAcceptNullValue(entity['x-nullable'], isPropRequired)) {
      let savedEntity = entity
      // handling nullable parameters
      if (savedEntity.in) {
        entity.oneOf = [{ "type": entity.type }, { "type": "null" }]
        delete entity.type
      } else {
        entity = {}
        entity.oneOf = [savedEntity, { "type": "null" }]
      }
    }
  }

  // if there's a $ref
  if (entity && entity["$ref"] && shouldAcceptNullValue(entity['x-nullable'], isPropRequired)) {
    let savedEntity = entity
    entity = {}
    entity.oneOf = [savedEntity, { "type": "null" }]
  }
  return entity
}

/** logic table to determine when to use oneOf to accept null values
* required \ x-nullable | True               | False | Undefined
* ===============================================================
* Yes                   | convert to oneOf[] |       |
* No                    | convert to oneOf[] |       | convert to oneOf[]
*/
export function shouldAcceptNullValue(xnullable: any, isPropRequired: any): boolean {
  const isPropNullable = xnullable && typeof xnullable === 'boolean'
  return (isPropNullable === undefined && !isPropRequired) || isPropNullable
}
/**
 * Relaxes/Transforms model definition to allow null values
 */
export function allowNullableTypes(model: any) {
  // process additionalProperties if present
  if (model && typeof model.additionalProperties === 'object') {
    if (model.additionalProperties.properties || model.additionalProperties.additionalProperties) {
      model.additionalProperties = allowNullableTypes(model.additionalProperties)
    } else {
      // there shouldn't be more properties nesting at this point
      model.additionalProperties = allowNullType(model.additionalProperties)
    }
  }
  if (model && model.properties) {
    let modelProperties = model.properties
    for (let propName of getKeys(modelProperties)) {
      // process properties if present
      if (modelProperties[propName].properties || modelProperties[propName].additionalProperties) {
        modelProperties[propName] = allowNullableTypes(modelProperties[propName])
      }
      modelProperties[propName] = allowNullType(
        modelProperties[propName], isPropertyRequired(propName, model))
    }
  }

  if (model && model.type) {
    if (model.type == 'array') {
      if (model.items) {
        // if items object contains additional properties
        if (model.items.additionalProperties && typeof model.items.additionalProperties === 'object') {
          if (model.items.additionalProperties.properties
            || model.items.additionalProperties.additionalProperties) {
            model.items.additionalProperties = allowNullableTypes(model.items.additionalProperties)
          } else {
            // there shouldn't be more properties nesting at this point
            model.items.additionalProperties = allowNullType(model.items.additionalProperties)
          }
        }
        // if items object contains inline properties
        if (model.items.properties) {
          model.items = allowNullableTypes(model.items)
        }
        else {
          model.items = allowNullType(model.items)
        }
      }
    }
    // if we have a top level "object" with x-nullable set, we need to relax the model at that level
    else if (model.type == "object" && model['x-nullable']) {
      model = allowNullType(model)
    }
  }

  // if model is a parameter (contains "in" property") we want to relax the parameter
  if (model && model.in && model['x-nullable']) {
    model = allowNullType(model, model["required"])
  }

  return model
}

/**
 * Relaxes/Transforms parameter definition to allow null values for non-path parameters
 */
export function allowNullableParams(parameter: any) {
  if (parameter["in"] && parameter["in"] === "body" && parameter["schema"]) {
    parameter["schema"] = allowNullableTypes(parameter["schema"])
  }
  else {
    if (parameter["in"] && parameter["in"] !== "path") {
      parameter = allowNullType(parameter, parameter["required"])
    }
  }
  return parameter
}

/**
 * Sanitizes the file name by replacing special characters with
 * empty string and by replacing space(s) with _.
 * @param {string} str - The string to be sanitized.
 * @returns {string} result - The sanitized string.
 */
export function sanitizeFileName(str: string): string {
  return str ? str.replace(/[{}\[\]'";\(\)#@~`!%&\^\$\+=,\/\\?<>\|\*:]/ig, '').replace(/(\s+)/ig, '_') : str
}

/**
 * Gets the values of an object or returns an empty Array if the object is not defined.
 * The check is necessary because Object.values does not coerce parameters to object type.
 * @param {*} obj
 */
export function getValues(obj: any): any[] {
  if (obj === undefined || obj === null) {
    return []
  }
  return Object.values(obj)
}

/**
 * Gets the keys of an object or returns an empty Array if the object is not defined.
.* The check is necessary because Object.keys does not coerce parameters to object type.
 * @param {*} obj
 */
export function getKeys(obj: any): string[] {
  if (obj === undefined || obj === null) {
    return []
  }

  return Object.keys(obj)
}

/**
 * Checks if the property is required in the model.
 */
function isPropertyRequired(propName: any, model: any) {
  return model.required ? model.required.some((p: any) => { return p == propName; }) : false
}

/**
 * Contains the reverse mapping of http.STATUS_CODES
 */
export const statusCodeStringToStatusCode = lodash.invert(
  lodash.mapValues(http.STATUS_CODES, (value: any) => { return value.replace(/ |-/g, "").toLowerCase(); }))

/**
 * Models an ARM cloud error schema.
 */
export const CloudErrorSchema = {
  description: "Error response describing why the operation failed.",
  schema: {
    "$ref": "#/definitions/CloudErrorWrapper"
  }
}

/**
 * Models an ARM cloud error wrapper.
 */
export const CloudErrorWrapper = {
  type: "object",
  properties: {
    error: {
      "$ref": "#/definitions/CloudError"
    }
  },
  additionalProperties: false
}

/**
 * Models a Cloud Error
 */
export const CloudError = {
  type: "object",
  properties: {
    code: {
      type: "string",
      description:
        "An identifier for the error. Codes are invariant and are intended to be consumed programmatically."
    },
    message: {
      type: "string",
      description: "A message describing the error, intended to be suitable for display in a user interface."
    },
    target: {
      type: "string",
      description: "The target of the particular error. For example, the name of the property in error."
    },
    details: {
      type: "array",
      items: { type: "object" },
      description: "A list of additional details about the error."
    },
    additionalInfo: {
      type: "array",
      items: { type: "object" },
      description: "A list of additional info about an error."
    },
    innererror: {
      type: "object"
    }
  },
  required: ["code", "message"],
  additionalProperties: false
}
