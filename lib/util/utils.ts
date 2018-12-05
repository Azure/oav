// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as fs from "fs"
import { execSync } from "child_process"
import * as util from "util"
import * as path from "path"
import * as jsonPointer from "json-pointer"
import { log } from "./logging"
import * as lodash from "lodash"
import * as http from "http"
import { MutableStringMap, entries } from "@ts-common/string-map"
import { ParameterObject, SchemaObject, DataType } from "yasway"
import {
  cloneDeep,
  Data,
  copyInfo
} from "@ts-common/source-map"
import { getSchemaObjectInfo, setSchemaInfo } from "../validators/specTransformer"

/*
 * Executes an array of promises sequentially. Inspiration of this method is here:
 * https://pouchdb.com/2015/05/18/we-have-a-problem-with-promises.html. An awesome blog on promises!
 *
 * @param {Array} promiseFactories An array of promise factories(A function that return a promise)
 *
 * @return A chain of resolved or rejected promises
 */
export async function executePromisesSequentially<T>(
  promiseFactories: ReadonlyArray<() => Promise<T>>
): Promise<ReadonlyArray<T>> {
  const result: T[] = []
  for (const promiseFactory of promiseFactories) {
    result.push(await promiseFactory())
  }
  return result
}

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
export function generateRandomId(prefix: string, existingIds: {}): string {
  let randomStr: string
  while (true) {
    randomStr = Math.random()
      .toString(36)
      .substr(2, 12)
    if (prefix && typeof prefix.valueOf() === "string") {
      randomStr = prefix + randomStr
    }
    if (!existingIds || !(randomStr in existingIds)) {
      break
    }
  }
  return randomStr
}

export interface Reference {
  readonly filePath?: string
  readonly localReference?: {
    readonly value: string
    readonly accessorProperty: string
  }
}

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
 *         {object} [result.localReference] Provides information about the local reference in the
 *                                          json document.
 *         {string} [result.localReference.value] The json reference value. Examples are:
 *           - '../newtwork.json#/definitions/Resource' => '#/definitions/Resource'
 *           - '#/parameters/SubscriptionId' => '#/parameters/SubscriptionId'
 *         {string} [result.localReference.accessorProperty] The json path expression that can be
 *                                                           used by
 *         eval() to access the desired object. Examples are:
 *           - '../newtwork.json#/definitions/Resource' => 'definitions.Resource'
 *           - '#/parameters/SubscriptionId' => 'parameters,SubscriptionId'
 */
export function parseReferenceInSwagger(reference: string): Reference {
  if (!reference || (reference && reference.trim().length === 0)) {
    throw new Error(
      "reference cannot be null or undefined and it must be a non-empty string."
    )
  }

  if (reference.includes("#")) {
    // local reference in the doc
    if (reference.startsWith("#/")) {
      return {
        localReference: {
          value: reference,
          accessorProperty: reference.slice(2).replace("/", ".")
        }
      }
    } else {
      // filePath+localReference
      const segments = reference.split("#")
      return {
        filePath: segments[0],
        localReference: {
          value: "#" + segments[1],
          accessorProperty: segments[1].slice(1).replace("/", ".")
        }
      }
    }
  } else {
    // we are assuming that the string is a relative filePath
    return { filePath: reference }
  }
}

/*
 * Same as path.join(), however, it converts backward slashes to forward slashes.
 * This is required because path.join() joins the paths and converts all the
 * forward slashes to backward slashes if executed on a windows system. This can
 * be problematic while joining a url. For example:
 * path.join(
 *  'https://github.com/Azure/openapi-validation-tools/blob/master/lib',
 *  '../examples/foo.json')
 * returns
 * 'https:\\github.com\\Azure\\openapi-validation-tools\\blob\\master\\examples\\foo.json'
 * instead of
 * 'https://github.com/Azure/openapi-validation-tools/blob/master/examples/foo.json'
 *
 * @param variable number of arguments and all the arguments must be of type string. Similar to
 * the API provided by path.join()
 * https://nodejs.org/dist/latest-v6.x/docs/api/path.html#path_path_join_paths
 * @return {string} resolved path
 */
export function joinPath(...args: string[]): string {
  let finalPath = path.join(...args)
  finalPath = finalPath.replace(/\\/gi, "/")
  finalPath = finalPath.replace(/^(http|https):\/(.*)/gi, "$1://$2")
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
/*
export async function parseJsonWithPathFragments(
  suppression: Suppression | undefined,
  ...args: string[],
): Promise<SwaggerObject> {
  const specPath = joinPath(...args)
  return await jsonUtils.parseJson(suppression, specPath)
}
*/

/*
 * Merges source object into the target object
 * @param {object} source The object that needs to be merged
 *
 * @param {object} target The object to be merged into
 *
 * @returns {object} target - Returns the merged target object.
 */
export function mergeObjects<T extends MutableStringMap<Data>>(
  source: T,
  target: T
): T {
  for (const [key, sourceProperty] of entries(source)) {
    if (Array.isArray(sourceProperty)) {
      const targetProperty = target[key]
      if (!targetProperty) {
        target[key] = sourceProperty
      } else if (!Array.isArray(targetProperty)) {
        throw new Error(
          `Cannot merge ${key} from source object into target object because the same property ` +
            `in target object is not (of the same type) an Array.`
        )
      } else {
        target[key] = mergeArrays(sourceProperty, targetProperty)
      }
    } else {
      target[key] = cloneDeep(sourceProperty)
    }
  }
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
export function mergeArrays<T extends Data>(source: ReadonlyArray<T>, target: T[]): T[] {
  if (!Array.isArray(target) || !Array.isArray(source)) {
    return target
  }
  source.forEach(item => {
    target.push(cloneDeep(item))
  })
  return target
}

/*
 * Gets the object from the given doc based on the provided json reference pointer.
 * It returns undefined if the location is not found in the doc.
 * @param {object} doc The source object.
 *
 * @param {string} ptr The json reference pointer
 *
 * @returns {unknown} result - Returns the value that the ptr points to, in the doc.
 */
export function getObject(doc: {}, ptr: string): unknown {
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
 * @param {unknown} value The value that needs to be set at the
 * location provided by the ptr in the doc.
 * @param {overwrite} Optional parameter to decide if a pointer value should be overwritten.
 */
export function setObject(
  doc: {},
  ptr: string,
  value: unknown,
  overwrite = true
) {
  let result
  try {
    if (overwrite || !jsonPointer.has(doc, ptr)) {
      result = jsonPointer.set(doc, ptr, value)
    }
  } catch (err) {
    log.error(err)
  }
  return result
}

/**
 * Gets provider namespace from the given path. In case of multiple, last one will be returned.
 * @param {string} pathStr The path of the operation.
 *                 Example "/subscriptions/{subscriptionId}/resourcegroups/{resourceGroupName}/
 *                  providers/{resourceProviderNamespace}/{parentResourcePath}/{resourceType}/
 *                  {resourceName}/providers/Microsoft.Authorization/roleAssignments"
 *                 will return "Microsoft.Authorization".
 *
 * @returns {string} result - provider namespace from the given path.
 */
export function getProvider(pathStr?: string | null): string | undefined {
  if (
    pathStr === null ||
    pathStr === undefined ||
    typeof pathStr.valueOf() !== "string" ||
    !pathStr.trim().length
  ) {
    throw new Error(
      "pathStr is a required parameter of type string and it cannot be an empty string."
    )
  }

  const providerRegEx = new RegExp("/providers/(:?[^{/]+)", "gi")
  let result

  // Loop over the paths to find the last matched provider namespace
  while (true) {
    const pathMatch = providerRegEx.exec(pathStr)
    if (pathMatch === null) {
      break
    }
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
export function gitClone(
  directory: string,
  url: string,
  branch: string | undefined
): void {
  if (
    url === null ||
    url === undefined ||
    typeof url.valueOf() !== "string" ||
    !url.trim().length
  ) {
    throw new Error(
      "url is a required parameter of type string and it cannot be an empty string."
    )
  }

  if (
    directory === null ||
    directory === undefined ||
    typeof directory.valueOf() !== "string" ||
    !directory.trim().length
  ) {
    throw new Error(
      "directory is a required parameter of type string and it cannot be an empty string."
    )
  }

  // If the directory exists then we assume that the repo to be cloned is already present.
  if (fs.existsSync(directory)) {
    if (fs.lstatSync(directory).isDirectory()) {
      try {
        removeDirSync(directory)
      } catch (err) {
        const text = util.inspect(err, { depth: null })
        throw new Error(
          `An error occurred while deleting directory ${directory}: ${text}.`
        )
      }
    } else {
      try {
        fs.unlinkSync(directory)
      } catch (err) {
        const text = util.inspect(err, { depth: null })
        throw new Error(
          `An error occurred while deleting file ${directory}: ${text}.`
        )
      }
    }
  }

  try {
    fs.mkdirSync(directory)
  } catch (err) {
    const text = util.inspect(err, { depth: null })
    throw new Error(
      `An error occurred while creating directory ${directory}: ${text}.`
    )
  }

  try {
    const isBranchDefined =
      branch !== null &&
      branch !== undefined &&
      typeof branch.valueOf() === "string"
    const cmd = isBranchDefined
      ? `git clone --depth=1 --branch ${branch} ${url} ${directory}`
      : `git clone --depth=1 ${url} ${directory}`
    execSync(cmd, { encoding: "utf8" })
  } catch (err) {
    throw new Error(
      `An error occurred while cloning git repository: ${util.inspect(err, {
        depth: null
      })}.`
    )
  }
}

/*
 * Removes given directory recursively.
 * @param {string} dir directory to be deleted.
 */
export function removeDirSync(dir: string): void {
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).forEach(file => {
      const current = dir + "/" + file
      if (fs.statSync(current).isDirectory()) {
        removeDirSync(current)
      } else {
        fs.unlinkSync(current)
      }
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
export function getJsonContentType(
  consumesOrProduces: string[]
): string | undefined {
  return consumesOrProduces
    ? consumesOrProduces.find(
        contentType => contentType.match(/.*\/json.*/gi) !== null
      )
    : undefined
}

/**
 * Determines whether the given string is url encoded
 * @param {string} str - The input string to be verified.
 * @returns {boolean} result - true if str is url encoded; false otherwise.
 */
export function isUrlEncoded(str: string): boolean {
  str = str || ""
  try {
    return str !== decodeURIComponent(str)
  } catch (e) {
    return false
  }
}

/**
 * Determines whether the given model is a pure (free-form) object candidate (i.e. equivalent of the
 * C# Object type).
 * @param {object} model - The model to be verified
 * @returns {boolean} result - true if model is a pure object; false otherwise.
 */
export function isPureObject(model: SchemaObject): boolean {
  if (!model) {
    throw new Error(
      `model cannot be null or undefined and must be of type "object"`
    )
  }
  if (
    model.type &&
    typeof model.type.valueOf() === "string" &&
    model.type === "object" &&
    model.properties &&
    model.properties.length === 0
  ) {
    return true
  } else if (!model.type && model.properties && model.properties.length === 0) {
    return true
  } else if (
    model.type &&
    typeof model.type.valueOf() === "string" &&
    model.type === "object" &&
    !model.properties &&
    !model.additionalProperties
  ) {
    return true
  } else {
    return false
  }
}

interface Entity {
  in?: string
  type?: DataType
  additionalProperties?: SchemaObject | boolean
  items?: SchemaObject
  "x-nullable"?: boolean
  oneOf?: ReadonlyArray<SchemaObject>
  $ref?: string
  anyOf?: ReadonlyArray<SchemaObject>
}

/**
 * Relaxes/Transforms the given entities type from a specific JSON schema primitive type
 * (http://json-schema.org/latest/json-schema-core.html#rfc.section.4.2)
 * to an array of JSON schema primitive types
 * (http://json-schema.org/latest/json-schema-validation.html#rfc.section.5.21).
 *
 * @param {object} entity - The entity to be relaxed.
 * @param {boolean|undefined} [isRequired] - A boolean value that indicates whether the entity is
 *                                           required or not.
 * If the entity is required then the primitive type "null" is not added.
 * @returns {object} entity - The transformed entity if it is a pure object else the same entity is
 * returned as-is.
 */
export function relaxEntityType<T extends Entity>(entity: T, _?: unknown): T {
  if (isPureObject(entity) && entity.type) {
    delete entity.type
  }
  if (
    typeof entity.additionalProperties === "object" &&
    isPureObject(entity.additionalProperties) &&
    entity.additionalProperties.type
  ) {
    delete entity.additionalProperties.type
  }
  return entity
}

/**
 * Relaxes/Transforms model definition like entities recursively
 */
export function relaxModelLikeEntities(model: SchemaObject): SchemaObject {
  model = relaxEntityType(model)
  if (model.properties) {
    const modelProperties = model.properties

    for (const [propName, property] of entries(modelProperties)) {
      modelProperties[propName] = property.properties
        ? relaxModelLikeEntities(property)
        : relaxEntityType(property, isPropertyRequired(propName, model))
    }
  }
  return model
}

/**
 * Relaxes the entity to be a anyOf: [the current type OR null type] if the condition is satisfied
 * @param {object} entity - The entity to be relaxed
 * @param {Boolean|undefined} isPropRequired - states whether the property is required.
 * If true then it is required. If false or undefined then it is not required.
 * @returns {object} entity - The processed entity
 */
export function allowNullType<T extends Entity>(
  entity: T,
  isPropRequired?: boolean | {}
): T {

  const info = getSchemaObjectInfo(entity)

  const nullable = () => {
    const typeNull: SchemaObject = setSchemaInfo({ type: "null" }, info)
    const typeArray = copyInfo(entity, [entity, typeNull])
    const newEntity: SchemaObject = setSchemaInfo({ anyOf: typeArray }, info)
    entity = newEntity as T
  }

  // if entity has a type
  if (entity && entity.type) {
    // if type is an array
    if (entity.type === "array") {
      if (entity.items) {
        // if items object contains inline properties
        entity.items = entity.items.properties
          ? allowNullableTypes(entity.items)
          : allowNullType(entity.items)
      }
    }

    // takes care of string 'false' and 'true'
    const xNullable = entity["x-nullable"] as string | boolean
    if (typeof xNullable === "string") {
      switch (xNullable.toLowerCase()) {
        case "false":
          entity["x-nullable"] = false
          break
        case "true":
          entity["x-nullable"] = true
          break
      }
    }

    if (shouldAcceptNullValue(entity["x-nullable"], isPropRequired)) {
      const savedEntity = entity
      // handling nullable parameters
      if (savedEntity.in) {
        const typeNull: SchemaObject = setSchemaInfo({ type: "null" }, info)
        const typeEntity: SchemaObject = setSchemaInfo({ type: entity.type }, info)
        const typeArray: ReadonlyArray<SchemaObject> = copyInfo(entity, [typeEntity, typeNull])
        entity.anyOf = typeArray
        delete entity.type
      } else {
        nullable()
      }
    }
  }

  // if there's a $ref
  if (
    entity &&
    entity.$ref &&
    shouldAcceptNullValue(entity["x-nullable"], isPropRequired)
  ) {
    nullable()
  }
  return entity
}

/** logic table to determine when to use anyOf to accept null values
 * required \ x-nullable | True               | False | Undefined
 * ===============================================================
 * Yes                   | convert to anyOf[] |       |
 * No                    | convert to anyOf[] |       | convert to anyOf[]
 */
export function shouldAcceptNullValue(
  xnullable: unknown,
  isPropRequired: unknown
): unknown {
  const isPropNullable = xnullable && typeof xnullable === "boolean"
  return (isPropNullable === undefined && !isPropRequired) || isPropNullable
}
/**
 * Relaxes/Transforms model definition to allow null values
 */
export function allowNullableTypes(model: SchemaObject): SchemaObject {
  // process additionalProperties if present
  if (model && typeof model.additionalProperties === "object") {
    model.additionalProperties =
      model.additionalProperties.properties ||
      model.additionalProperties.additionalProperties
        ? allowNullableTypes(model.additionalProperties)
        : // there shouldn't be more properties nesting at this point
          allowNullType(model.additionalProperties)
  }
  if (model && model.properties) {
    const modelProperties = model.properties
    for (const [propName, prop] of entries(modelProperties)) {
      // process properties if present
      modelProperties[propName] =
        prop.properties || prop.additionalProperties
          ? allowNullableTypes(prop)
          : allowNullType(prop, isPropertyRequired(propName, model))
    }
  }

  if (model && model.type) {
    if (model.type === "array") {
      if (model.items) {
        // if items object contains additional properties
        if (
          model.items.additionalProperties &&
          typeof model.items.additionalProperties === "object"
        ) {
          model.items.additionalProperties =
            model.items.additionalProperties.properties ||
            model.items.additionalProperties.additionalProperties
              ? allowNullableTypes(model.items.additionalProperties)
              : // there shouldn't be more properties nesting at this point
                allowNullType(model.items.additionalProperties)
        }
        // if items object contains inline properties
        model.items = model.items.properties
          ? allowNullableTypes(model.items)
          : allowNullType(model.items)
      }
      // tslint:disable-next-line:max-line-length
      // if we have a top level "object" with x-nullable set, we need to relax the model at that level
    } else if (model.type === "object" && model["x-nullable"]) {
      model = allowNullType(model)
    }
  }

  // if model is a parameter (contains "in" property") we want to relax the parameter
  if (model && model.in && model["x-nullable"]) {
    model = allowNullType(model, model.required)
  }

  return model
}

/**
 * Relaxes/Transforms parameter definition to allow null values for non-path parameters
 */
export function allowNullableParams(
  parameter: ParameterObject
): ParameterObject {
  if (parameter.in && parameter.in === "body" && parameter.schema) {
    parameter.schema = allowNullableTypes(parameter.schema)
  } else {
    if (parameter.in && parameter.in !== "path") {
      parameter = allowNullType(parameter, parameter.required)
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
export const sanitizeFileName = (str: string): string =>
  str
    ? str
        .replace(/[{}\[\]'";\(\)#@~`!%&\^\$\+=,\/\\?<>\|\*:]/gi, "")
        .replace(/(\s+)/gi, "_")
    : str

/**
 * Checks if the property is required in the model.
 */
const isPropertyRequired = (propName: unknown, model: SchemaObject) =>
  model.required ? model.required.some(p => p === propName) : false

/**
 * Contains the reverse mapping of http.STATUS_CODES
 */
export const statusCodeStringToStatusCode = lodash.invert(
  lodash.mapValues(http.STATUS_CODES, (value: string) =>
    value.replace(/ |-/g, "").toLowerCase()
  )
)
