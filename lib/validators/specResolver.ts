// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as _ from "lodash"
import * as path from "path"
import * as JsonRefs from "json-refs"
import * as utils from "../util/utils"
import * as C from "../util/constants"
import { log } from "../util/logging"
import { PolymorphicTree } from "./polymorphicTree"
import {
  SwaggerObject,
  ParametersDefinitionsObject,
  ParameterObject,
  SchemaObject,
  DefinitionsObject,
  PathsObject,
  OperationObject
} from "yasway"
import { defaultIfUndefinedOrNull } from "../util/defaultIfUndefinedOrNull"
import { MutableStringMap } from "@ts-common/string-map"
import { resolveNestedDefinitions } from "./resolveNestedDefinitions"
import { getOperations } from "../util/methods"
import { transform } from "./specTransformer"

const ErrorCodes = C.ErrorCodes

export interface Options {
  shouldResolveRelativePaths?: boolean | null
  shouldResolveXmsExamples?: boolean | null
  shouldResolveAllOf?: boolean
  shouldSetAdditionalPropertiesFalse?: boolean
  shouldResolvePureObjects?: boolean | null
  shouldResolveDiscriminator?: boolean
  shouldResolveParameterizedHost?: boolean | null
  shouldResolveNullableTypes?: boolean
  shouldModelImplicitDefaultResponse?: boolean | null
}

export interface RefDetails {
  def: {
    $ref: string
  }
}

/**
 * @class
 * Resolves the swagger spec by unifying x-ms-paths, resolving relative file references if any,
 * resolving the allOf is present in any model definition and then setting additionalProperties
 * to false if it is not previously set to true or an object in that definition.
 */
export class SpecResolver {
  public specInJson: SwaggerObject

  private readonly specPath: string

  private readonly specDir: unknown

  private readonly visitedEntities: MutableStringMap<SchemaObject> = {}

  private readonly resolvedAllOfModels: MutableStringMap<SchemaObject> = {}

  private readonly options: Options

  /**
   * @constructor
   * Initializes a new instance of the SpecResolver class.
   *
   * @param {string} specPath the (remote|local) swagger spec path
   *
   * @param {object} specInJson the parsed spec in json format
   *
   * @param {object} [options] The options object
   *
   * @param {object} [options.shouldResolveRelativePaths] Should relative paths be resolved?
   *    Default: true
   *
   * @param {object} [options.shouldResolveXmsExamples] Should x-ms-examples be resolved?
   *    Default: true. If options.shouldResolveRelativePaths is false then this option will also be
   *    false implicitly and cannot be overridden.
   *
   * @param {object} [options.shouldResolveAllOf] Should allOf references be resolved? Default: true
   *
   * @param {object} [options.shouldResolveDiscriminator] Should discriminator be resolved?
   *    Default: true
   *
   * @param {object} [options.shouldSetAdditionalPropertiesFalse] Should additionalProperties be set
   *    to false? Default: true
   *
   * @param {object} [options.shouldResolvePureObjects] Should pure objects be resolved?
   *    Default: true
   *
   * @param {object} [options.shouldResolveParameterizedHost] Should x-ms-parameterized-host be
   *    resolved? Default: true
   *
   * @param {object} [options.shouldResolveNullableTypes] Should we allow null values to match any
   *    type? Default: true
   *
   * @param {object} [options.shouldModelImplicitDefaultResponse] Should we model a default response
   *    even if it is not defined? Default: false
   *
   * @return {object} An instance of the SpecResolver class.
   */
  constructor(specPath: string, specInJson: SwaggerObject, options: Options) {
    if (
      specPath === null ||
      specPath === undefined ||
      typeof specPath !== "string" ||
      !specPath.trim().length
    ) {
      throw new Error(
        "specPath is a required property of type string and it cannot be an empty string."
      )
    }

    if (
      specInJson === null ||
      specInJson === undefined ||
      typeof specInJson !== "object"
    ) {
      throw new Error("specInJson is a required property of type object")
    }
    this.specInJson = specInJson
    this.specPath = specPath
    this.specDir = path.dirname(this.specPath)

    options = defaultIfUndefinedOrNull(options, {})

    options.shouldResolveRelativePaths = defaultIfUndefinedOrNull(
      options.shouldResolveRelativePaths,
      true
    )

    options.shouldResolveXmsExamples = defaultIfUndefinedOrNull(
      options.shouldResolveXmsExamples,
      true
    )

    if (
      options.shouldResolveAllOf === null ||
      options.shouldResolveAllOf === undefined
    ) {
      if (!_.isUndefined(specInJson.definitions)) {
        options.shouldResolveAllOf = true
      }
    }

    // Resolving allOf is a necessary precondition for resolving discriminators. Hence hard setting
    // this to true
    if (options.shouldResolveDiscriminator) {
      options.shouldResolveAllOf = true
    }

    options.shouldSetAdditionalPropertiesFalse = defaultIfUndefinedOrNull(
      options.shouldSetAdditionalPropertiesFalse,
      options.shouldResolveAllOf
    )

    options.shouldResolvePureObjects = defaultIfUndefinedOrNull(
      options.shouldResolvePureObjects,
      true
    )

    options.shouldResolveDiscriminator = defaultIfUndefinedOrNull(
      options.shouldResolveDiscriminator,
      options.shouldResolveAllOf
    )

    options.shouldResolveParameterizedHost = defaultIfUndefinedOrNull(
      options.shouldResolveParameterizedHost,
      true
    )

    options.shouldResolveNullableTypes = defaultIfUndefinedOrNull(
      options.shouldResolveNullableTypes,
      options.shouldResolveAllOf
    )

    options.shouldModelImplicitDefaultResponse = defaultIfUndefinedOrNull(
      options.shouldModelImplicitDefaultResponse,
      false
    )

    this.options = options
  }

  /**
   * Resolves the swagger spec by unifying x-ms-paths, resolving relative file references if any,
   * resolving the allOf is present in any model definition and then setting additionalProperties
   * to false if it is not previously set to true or an object in that definition.
   */
  public async resolve(): Promise<this> {
    try {
      // path resolvers
      this.unifyXmsPaths()
      if (this.options.shouldResolveRelativePaths) {
        await this.resolveRelativePaths()
      }
      // resolve nested definitions
      this.specInJson = resolveNestedDefinitions(this.specInJson)

      // all transformations without dependencies should be moved here)
      this.specInJson = transform(this.specInJson)
      // other resolvers
      if (this.options.shouldResolveAllOf) {
        this.resolveAllOfInDefinitions()
      }
      if (this.options.shouldResolveDiscriminator) {
        this.resolveDiscriminator()
      }
      if (this.options.shouldResolveAllOf) {
        this.deleteReferencesToAllOf()
      }
      if (this.options.shouldSetAdditionalPropertiesFalse) {
        this.setAdditionalPropertiesFalse()
      }
      if (this.options.shouldResolveParameterizedHost) {
        this.resolveParameterizedHost()
      }
      if (this.options.shouldResolvePureObjects) {
        this.resolvePureObjects()
      }
      if (this.options.shouldResolveNullableTypes) {
        this.resolveNullableTypes()
      }
      if (this.options.shouldModelImplicitDefaultResponse) {
        this.modelImplicitDefaultResponse()
      }
    } catch (err) {
      const e = {
        message:
          `An Error occurred while resolving relative references and allOf in model definitions ` +
          `in the swagger spec: "${this.specPath}".`,
        code: ErrorCodes.ResolveSpecError.name,
        id: ErrorCodes.ResolveSpecError.id,
        innerErrors: [err]
      }
      log.error(err)
      throw e
    }
    return this
  }

  /**
   * Resolves the references to relative paths in the provided object.
   *
   * @param {object} [doc] the json doc that contains relative references. Default: self.specInJson
   *    (current swagger spec).
   *
   * @param {string} [docPath] the absolute (local|remote) path of the doc Default: self.specPath
   *    (current swagger spec path).
   *
   * @param {string} [filterType] the type of paths to filter. By default the method will resolve
   *    'relative' and 'remote' references.
   *    If provided the value should be 'all'. This indicates that 'local' references should also be
   *    resolved apart from the default ones.
   *
   * @return {Promise<void>}
   */
  private async resolveRelativePaths(
    doc?: unknown,
    docPath?: string,
    filterType?: string
  ): Promise<void> {
    let docDir

    const options = {
      /* TODO: it looks like a bug, relativeBase is always undefined */
      relativeBase: docDir,
      filter: ["relative", "remote"]
    }

    if (!doc) {
      doc = this.specInJson
    }
    if (!docPath) {
      docPath = this.specPath
      docDir = this.specDir
    }
    if (!docDir) {
      docDir = path.dirname(docPath)
    }
    if (filterType === "all") {
      delete options.filter
    }

    const allRefsRemoteRelative = JsonRefs.findRefs(doc, options)
    const promiseFactories = utils
      .getKeys(allRefsRemoteRelative)
      .map(refName => {
        const refDetails = allRefsRemoteRelative[refName]
        return async () =>
          await this.resolveRelativeReference(refName, refDetails, doc, docPath)
      })
    if (promiseFactories.length) {
      await utils.executePromisesSequentially(promiseFactories)
    }
  }

  /**
   * Merges the x-ms-paths object into the paths object in swagger spec. The method assumes that the
   * paths present in "x-ms-paths" and "paths" are unique. Hence it does a simple union.
   */
  private unifyXmsPaths(): void {
    // unify x-ms-paths into paths
    const xmsPaths = this.specInJson["x-ms-paths"]
    const paths = this.specInJson.paths as PathsObject
    if (
      xmsPaths &&
      xmsPaths instanceof Object &&
      utils.getKeys(xmsPaths).length > 0
    ) {
      for (const property of utils.getKeys(xmsPaths)) {
        paths[property] = xmsPaths[property]
      }
      this.specInJson.paths = utils.mergeObjects(xmsPaths, paths)
    }
  }

  /**
   * Resolves the relative reference in the provided object. If the object to be resolved contains
   * more relative references then this method will call resolveRelativePaths
   *
   * @param {string} refName the reference name/location that has a relative reference
   *
   * @param {object} refDetails the value or the object that the refName points at
   *
   * @param {object} doc the doc in which the refName exists
   *
   * @param {string} docPath the absolute (local|remote) path of the doc
   *
   * @return undefined the modified object
   */
  private async resolveRelativeReference(
    refName: string,
    refDetails: RefDetails,
    doc: unknown,
    docPath: string | undefined
  ): Promise<void> {
    if (!refName || (refName && typeof refName.valueOf() !== "string")) {
      throw new Error(
        'refName cannot be null or undefined and must be of type "string".'
      )
    }

    if (!refDetails || (refDetails && !(refDetails instanceof Object))) {
      throw new Error(
        'refDetails cannot be null or undefined and must be of type "object".'
      )
    }

    if (!doc || (doc && !(doc instanceof Object))) {
      throw new Error(
        'doc cannot be null or undefined and must be of type "object".'
      )
    }

    if (!docPath || (docPath && typeof docPath.valueOf() !== "string")) {
      throw new Error(
        'docPath cannot be null or undefined and must be of type "string".'
      )
    }

    const self = this
    const node = refDetails.def
    const slicedRefName = refName.slice(1)
    const reference = node.$ref
    const parsedReference = utils.parseReferenceInSwagger(reference)
    const docDir = path.dirname(docPath)

    if (parsedReference.filePath) {
      // assuming that everything in the spec is relative to it, let us join the spec directory
      // and the file path in reference.
      docPath = utils.joinPath(docDir, parsedReference.filePath)
    }

    const result = await utils.parseJson(docPath)
    if (!parsedReference.localReference) {
      // Since there is no local reference we will replace the key in the object with the parsed
      // json (relative) file it is referring to.
      const regex = /.*x-ms-examples.*/gi
      if (
        self.options.shouldResolveXmsExamples ||
        (!self.options.shouldResolveXmsExamples &&
          slicedRefName.match(regex) === null)
      ) {
        // TODO: doc should have a type
        utils.setObject(doc as {}, slicedRefName, result)
      }
    } else {
      // resolve the local reference.
      // make the reference local to the doc being processed
      node.$ref = parsedReference.localReference.value
      // TODO: doc should have a type
      utils.setObject(doc as {}, slicedRefName, node)
      const slicedLocalReferenceValue = parsedReference.localReference.value.slice(1)
      let referencedObj = self.visitedEntities[slicedLocalReferenceValue]
      if (!referencedObj) {
        // We get the definition/parameter from the relative file and then add it (make it local)
        // to the doc (i.e. self.specInJson) being processed.
        referencedObj = utils.getObject(result, slicedLocalReferenceValue)
        utils.setObject(
          self.specInJson,
          slicedLocalReferenceValue,
          referencedObj
        )
        self.visitedEntities[slicedLocalReferenceValue] = referencedObj
        await self.resolveRelativePaths(referencedObj, docPath, "all")
        // After resolving a model definition, if there are models that have an allOf on that model
        // definition.
        // It may be possible that those models are not being referenced anywhere. Hence, we must
        // ensure that they are consumed as well. Example model "CopyActivity" in file
        // arm-datafactory/2017-03-01-preview/swagger/entityTypes/Pipeline.json is having an allOf
        // on model "Activity". Spec "datafactory.json" has references to "Activity" in
        // Pipeline.json but there are no references to "CopyActivity". The following code, ensures
        // that we do not forget such models while resolving relative swaggers.
        if (result && result.definitions) {
          const definitions = result.definitions
          const unresolvedDefinitions: Array<() => Promise<void>> = []

          function processDefinition(defName: string) {
            unresolvedDefinitions.push(async () => {
              const allOf = definitions[defName].allOf
              if (allOf) {
                const matchFound = allOf.some(
                  () => !self.visitedEntities[`/definitions/${defName}`]
                )
                if (matchFound) {
                  const slicedDefinitionRef = `/definitions/${defName}`
                  const definitionObj = definitions[defName]
                  utils.setObject(
                    self.specInJson,
                    slicedDefinitionRef,
                    definitionObj
                  )
                  self.visitedEntities[slicedDefinitionRef] = definitionObj
                  await self.resolveRelativePaths(definitionObj, docPath, "all")
                }
              }
            })
          }

          for (const defName of utils.getKeys(result.definitions)) {
            processDefinition(defName)
          }

          await utils.executePromisesSequentially(unresolvedDefinitions)
        }
      }
    }
  }

  /**
   * Resolves the "allOf" array present in swagger model definitions by composing all the properties
   * of the parent model into the child model.
   */
  private resolveAllOfInDefinitions(): void {
    const spec = this.specInJson
    const definitions = spec.definitions as DefinitionsObject
    const modelNames = utils.getKeys(definitions)
    modelNames.forEach(modelName => {
      const model = definitions[modelName]
      const modelRef = "/definitions/" + modelName
      this.resolveAllOfInModel(model, modelRef)
    })
  }

  /**
   * Resolves the "allOf" array present in swagger model definitions by composing all the properties
   * of the parent model into the child model.
   */
  private resolveAllOfInModel(
    model: SchemaObject,
    modelRef: string | undefined
  ) {
    const spec = this.specInJson

    if (!model || (model && typeof model !== "object")) {
      throw new Error(
        `model cannot be null or undefined and must of type "object".`
      )
    }

    if (!modelRef || (modelRef && typeof modelRef.valueOf() !== "string")) {
      throw new Error(
        `model cannot be null or undefined and must of type "string".`
      )
    }

    if (modelRef.startsWith("#")) {
      modelRef = modelRef.slice(1)
    }

    if (!this.resolvedAllOfModels[modelRef]) {
      if (model && model.allOf) {
        model.allOf.forEach(item => {
          const ref = item.$ref
          const slicedRef = ref ? ref.slice(1) : undefined
          const referencedModel =
            slicedRef === undefined
              ? item
              : (utils.getObject(spec, slicedRef) as SchemaObject)
          if (referencedModel.allOf) {
            this.resolveAllOfInModel(referencedModel, slicedRef)
          }
          model = this.mergeParentAllOfInChild(referencedModel, model)
          this.resolvedAllOfModels[slicedRef as string] = referencedModel
        })
      } else {
        this.resolvedAllOfModels[modelRef] = model
        return model
      }
    }

    return
  }

  /**
   * Merges the properties of the parent model into the child model.
   *
   * @param {object} parent object to be merged. Example: "Resource".
   *
   * @param {object} child object to be merged. Example: "Storage".
   *
   * @return {object} returns the merged child object
   */
  private mergeParentAllOfInChild(
    parent: SchemaObject,
    child: SchemaObject
  ): SchemaObject {
    if (!parent || (parent && typeof parent !== "object")) {
      throw new Error(`parent must be of type "object".`)
    }
    if (!child || (child && typeof child !== "object")) {
      throw new Error(`child must be of type "object".`)
    }
    // merge the parent (Resource) model's properties into the properties
    // of the child (StorageAccount) model.
    if (!parent.properties) {
      parent.properties = {}
    }
    if (!child.properties) {
      child.properties = {}
    }
    child.properties = utils.mergeObjects(parent.properties, child.properties)
    // merge the array of required properties
    if (parent.required) {
      if (!child.required) {
        child.required = []
      }
      child.required = [...new Set([...parent.required, ...child.required])]
    }
    // merge x-ms-azure-resource
    if (parent["x-ms-azure-resource"]) {
      child["x-ms-azure-resource"] = parent["x-ms-azure-resource"]
    }
    return child
  }

  /**
   * Deletes all the references to allOf from all the model definitions in the swagger spec.
   */
  private deleteReferencesToAllOf(): void {
    const self = this
    const spec = self.specInJson
    const definitions = spec.definitions as DefinitionsObject
    const modelNames = utils.getKeys(definitions)
    modelNames.forEach(modelName => {
      if (definitions[modelName].allOf) {
        delete definitions[modelName].allOf
      }
    })
  }

  /**
   * Sets additionalProperties to false if additionalProperties is not defined.
   */
  private setAdditionalPropertiesFalse(): void {
    const self = this
    const spec = self.specInJson
    const definitions = spec.definitions as DefinitionsObject

    const modelNames = utils.getKeys(definitions)
    modelNames.forEach(modelName => {
      const model = definitions[modelName]
      if (model) {
        if (
          !model.additionalProperties &&
          !(
            !model.properties ||
            (model.properties && utils.getKeys(model.properties).length === 0)
          )
        ) {
          model.additionalProperties = false
        }
      }
    })
  }

  /**
   * Resolves the parameters provided in 'x-ms-parameterized-host'
   * extension by adding those parameters as local parameters to every operation.
   *
   * ModelValidation:
   * This step should only be performed for model validation as we need to
   * make sure that the examples contain correct values for parameters
   * defined in 'x-ms-parameterized-host'.hostTemplate. Moreover, they are a
   * part of the baseUrl.
   *
   * SemanticValidation:
   * This step should not be performed for semantic validation, otherwise there will
   * be a mismatch between the number of path parameters provided in the operation
   * definition and the number of parameters actually present in the path template.
   */
  private resolveParameterizedHost(): void {
    const self = this
    const spec = self.specInJson
    const parameterizedHost = spec[C.xmsParameterizedHost]
    const hostParameters = parameterizedHost
      ? parameterizedHost.parameters
      : null
    if (parameterizedHost && hostParameters) {
      const paths = spec.paths as PathsObject
      for (const verbs of utils.getValues(paths)) {
        for (const operation of getOperations(verbs)) {
          let operationParameters = operation.parameters
          if (!operationParameters) {
            operationParameters = []
          }
          // merge host parameters into parameters for that operation.
          operation.parameters = operationParameters.concat(hostParameters)
        }
      }
    }
  }

  /**
   * Resolves entities (parameters, definitions, model properties, etc.) in the spec that are true
   * objects.
   * i.e `"type": "object"` and `"properties": {}` or `"properties"` is absent or the entity has
   * "additionalProperties": { "type": "object" }.
   */
  private resolvePureObjects(): void {
    const self = this
    const spec = self.specInJson
    const definitions = spec.definitions as DefinitionsObject

    // scan definitions and properties of every model in definitions
    for (const model of utils.getValues(definitions)) {
      utils.relaxModelLikeEntities(model)
    }

    const resolveOperation = (operation: OperationObject) => {
      // scan every parameter in the operation
      const consumes = _.isUndefined(operation.consumes)
        ? _.isUndefined(spec.consumes)
          ? ["application/json"]
          : spec.consumes
        : operation.consumes

      const produces = _.isUndefined(operation.produces)
        ? _.isUndefined(spec.produces)
          ? ["application/json"]
          : spec.produces
        : operation.produces

      const octetStream = (elements: string[]) => {
        return elements.some(
          e => e.toLowerCase() === "application/octet-stream"
        )
      }

      const resolveParameter2 = (param: ParameterObject) => {
        if (
          param.in &&
          param.in === "body" &&
          param.schema &&
          !octetStream(consumes)
        ) {
          param.schema = utils.relaxModelLikeEntities(param.schema)
        } else {
          param = utils.relaxEntityType(param, param.required)
        }
      }

      if (operation.parameters) {
        operation.parameters.forEach(resolveParameter2)
      }
      // scan every response in the operation
      if (operation.responses) {
        for (const response of utils.getValues(operation.responses)) {
          if (response.schema && !octetStream(produces)) {
            response.schema = utils.relaxModelLikeEntities(response.schema)
          }
        }
      }
    }

    const resolveParameter = (param: ParameterObject) => {
      if (param.in && param.in === "body" && param.schema) {
        param.schema = utils.relaxModelLikeEntities(param.schema)
      } else {
        param = utils.relaxEntityType(param, param.required)
      }
    }

    // scan every operation
    for (const pathObj of utils.getValues(spec.paths as PathsObject)) {
      for (const operation of getOperations(pathObj)) {
        resolveOperation(operation)
      }
      // scan path level parameters if any
      if (pathObj.parameters) {
        pathObj.parameters.forEach(resolveParameter)
      }
    }
    // scan global parameters
    const parameters = spec.parameters as ParametersDefinitionsObject
    for (const param of utils.getKeys(parameters)) {
      const parameter = parameters[param]
      if (parameter.in && parameter.in === "body" && parameter.schema) {
        parameter.schema = utils.relaxModelLikeEntities(parameter.schema)
      }
      parameters[param] = utils.relaxEntityType(parameter, parameter.required)
    }
  }

  /**
   * Models a default response as a Cloud Error if none is specified in the api spec.
   */
  private modelImplicitDefaultResponse(): void {
    const self = this
    const spec = self.specInJson
    const definitions = spec.definitions as DefinitionsObject
    if (!definitions.CloudError) {
      definitions.CloudErrorWrapper = utils.CloudErrorWrapper
      definitions.CloudError = utils.CloudError
    }
    for (const pathObj of utils.getValues(spec.paths as PathsObject)) {
      for (const operation of getOperations(pathObj)) {
        if (operation.responses && !operation.responses.default) {
          operation.responses.default = utils.CloudErrorSchema
        }
      }
    }
  }

  /**
   * Resolves the discriminator by replacing all the references to the parent model with a oneOf
   * array containing
   * references to the parent model and all its child models. It also modifies the discriminator
   * property in
   * the child models by making it a constant (enum with one value) with the value expected for that
   * model
   * type on the wire.
   * For example: There is a model named "Animal" with a discriminator as "animalType". Models like
   * "Cat", "Dog",
   * "Tiger" are children (having "allof": [ { "$ref": "#/definitions/Animal" } ] on) of "Animal" in
   *  the swagger spec.
   *
   * - This method will replace all the locations in the swagger spec that have a reference to the
   * parent model "Animal" ("$ref": "#/definitions/Animal") except the allOf reference with a oneOf
   * reference
   * "oneOf": [ { "$ref": "#/definitions/Animal" }, { "$ref": "#/definitions/Cat" }, { "$ref":
   * "#/definitions/Dog" }, { "$ref": "#/definitions/Tiger" } ]
   *
   * - It will also add a constant value (name of that animal on the wire or the value provided by
   * "x-ms-discriminator-value")
   * to the discrimiantor property "animalType" for each of the child models.
   * For example:  the Cat model's discriminator property will look like:
   * "Cat": { "required": [ "animalType" ], "properties": { "animalType": { "type": "string",
   * "enum": [ "Cat" ] },  . . } }.
   */
  private resolveDiscriminator(): void {
    const self = this
    const spec = self.specInJson
    const definitions = spec.definitions as DefinitionsObject
    const modelNames = utils.getKeys(definitions)
    const subTreeMap = new Map()
    const references = JsonRefs.findRefs(spec)

    modelNames.forEach(modelName => {
      const discriminator = definitions[modelName].discriminator
      if (discriminator) {
        let rootNode = subTreeMap.get(modelName)
        if (!rootNode) {
          rootNode = self.createPolymorphicTree(
            modelName,
            discriminator,
            subTreeMap
          )
        }
        self.updateReferencesWithOneOf(subTreeMap, references)
      }
    })
  }

  /**
   * Resolves all properties in models or responses that have a "type" defined, so that if the
   * property
   * is marked with "x-nullable", we'd honor it: we'd relax the type to include "null" if value is
   * true, we won't if value is false.
   * If the property does not have the "x-nullable" extension, then if not required, we'll relax
   * the type to include "null"; if required we won't.
   * The way we're relaxing the type is to have the model be a "oneOf" array with one value being
   * the original content of the model and the second value "type": "null".
   */
  private resolveNullableTypes(): void {
    const self = this
    const spec = self.specInJson
    const definitions = spec.definitions as DefinitionsObject

    // scan definitions and properties of every model in definitions
    for (const defName of utils.getKeys(definitions)) {
      const model = definitions[defName]
      definitions[defName] = utils.allowNullableTypes(model)
    }
    // scan every operation response
    for (const pathObj of utils.getValues(spec.paths as PathsObject)) {
      // need to handle parameters at this level
      if (pathObj.parameters) {
        for (const parameter of utils.getKeys(pathObj.parameters)) {
          const n = parseInt(parameter)
          pathObj.parameters[n] = utils.allowNullableParams(
            pathObj.parameters[n]
          )
        }
      }
      for (const operation of getOperations(pathObj)) {
        // need to account for parameters, except for path parameters
        if (operation.parameters) {
          for (const parameter of utils.getKeys(operation.parameters)) {
            const n = parseInt(parameter)
            operation.parameters[n] = utils.allowNullableParams(
              operation.parameters[n]
            )
          }
        }
        // going through responses
        if (operation.responses) {
          for (const response of utils.getValues(operation.responses)) {
            if (response.schema) {
              response.schema = utils.allowNullableTypes(response.schema)
            }
          }
        }
      }
    }

    // scan parameter definitions
    const parameters = spec.parameters as ParametersDefinitionsObject
    for (const parameter of utils.getKeys(parameters)) {
      parameters[parameter] = utils.allowNullableParams(parameters[parameter])
    }
  }

  /**
   * Updates the reference to a parent node with a oneOf array containing a reference to the parent
   * and all its children.
   *
   * @param {Map<string, PolymorphicTree>} subTreeMap - A map containing a reference to a node in
   *    the PolymorphicTree.
   * @param {object} references - This object is the output of findRefs function from "json-refs"
   * library. Please refer
   * to the documentation of json-refs over
   * [here](https://bit.ly/2sw5MOa)
   * for detailed structure of the object.
   */
  private updateReferencesWithOneOf(
    subTreeMap: Map<string, PolymorphicTree>,
    references: any[]
  ): void {
    const spec = this.specInJson

    for (const node of subTreeMap.values()) {
      // Have to process all the non-leaf nodes only
      if (node.children.size > 0) {
        const locationsToBeUpdated = []
        const modelReference = `#/definitions/${node.name}`
        // Create a list of all the locations where the current node is referenced
        for (const key in references) {
          if (
            references[key].uri === modelReference &&
            key.indexOf("allOf") === -1 &&
            key.indexOf("oneOf") === -1
          ) {
            locationsToBeUpdated.push(key)
          }
        }
        // Replace the reference to that node in that location with a oneOf array
        // containing reference to the node and all its children.
        for (const location of locationsToBeUpdated) {
          const slicedLocation = location.slice(1)
          const obj = utils.getObject(spec, slicedLocation)
          if (obj) {
            if (obj.$ref) {
              delete obj.$ref
            }
            obj.oneOf = [...this.buildOneOfReferences(node)]
            utils.setObject(spec, slicedLocation, obj)
          }
        }
      }
    }
  }

  /**
   * Creates a PolymorphicTree for a given model in the inheritance chain
   *
   * @param {string} name- Name of the model for which the tree needs to be created.
   * @param {string} discriminator- Name of the property that is marked as the discriminator.
   * @param {Map<string, PolymorphicTree>} subTreeMap- A map that stores a reference to
   * PolymorphicTree for a given model in the inheritance chain.
   * @returns {PolymorphicTree} rootNode- A PolymorphicTree that represents the model in the
   * inheritance chain.
   */
  private createPolymorphicTree(
    name: string,
    discriminator: string,
    subTreeMap: Map<string, PolymorphicTree>
  ): PolymorphicTree {
    if (
      name === null ||
      name === undefined ||
      typeof name.valueOf() !== "string" ||
      !name.trim().length
    ) {
      throw new Error(
        "name is a required property of type string and it cannot be an empty string."
      )
    }

    if (
      discriminator === null ||
      discriminator === undefined ||
      typeof discriminator.valueOf() !== "string" ||
      !discriminator.trim().length
    ) {
      throw new Error(
        "discriminator is a required property of type string and it cannot be an empty string."
      )
    }

    if (
      subTreeMap === null ||
      subTreeMap === undefined ||
      !(subTreeMap instanceof Map)
    ) {
      throw new Error("subTreeMap is a required property of type Map.")
    }

    const rootNode = new PolymorphicTree(name)
    const definitions = this.specInJson.definitions as DefinitionsObject

    // Adding the model name or it's discriminator value as an enum constraint with one value
    // (constant) on property marked as discriminator
    const definition = definitions[name]
    if (
      definition &&
      definition.properties &&
      definition.properties[discriminator]
    ) {
      const val = definition["x-ms-discriminator-value"] || name
      // Ensure that the property marked as a discriminator has only one value in the enum
      // constraint for that model and it
      // should be the one that is the model name or the value indicated by
      // x-ms-discriminator-value. This will make the discriminator
      // property a constant (in json schema terms).
      if (definition.properties[discriminator].$ref) {
        delete definition.properties[discriminator].$ref
      }
      // We will set "type" to "string". It is safe to assume that properties marked as
      // "discriminator" will be of type "string"
      // as it needs to refer to a model definition name. Model name would be a key in the
      // definitions object/dictionary in the
      // swagger spec. keys would always be a string in a JSON object/dictionary.
      if (!definition.properties[discriminator].type) {
        definition.properties[discriminator].type = "string"
      }
      definition.properties[discriminator].enum = [`${val}`]
    }

    const children = this.findChildren(name)
    for (const childName of children) {
      const childObj = this.createPolymorphicTree(
        childName,
        discriminator,
        subTreeMap
      )
      rootNode.addChildByObject(childObj)
    }
    // Adding the created sub tree in the subTreeMap for future use.
    subTreeMap.set(rootNode.name, rootNode)
    return rootNode
  }

  /**
   * Finds children of a given model in the inheritance chain.
   *
   * @param {string} name- Name of the model for which the children need to be found.
   * @returns {Set} result- A set of model names that are the children of the given model in the
   *    inheritance chain.
   */
  private findChildren(name: string): Set<string> {
    if (
      name === null ||
      name === undefined ||
      typeof name.valueOf() !== "string" ||
      !name.trim().length
    ) {
      throw new Error(
        "name is a required property of type string and it cannot be an empty string."
      )
    }
    const definitions = this.specInJson.definitions as DefinitionsObject
    const reference = `#/definitions/${name}`
    const result = new Set()

    const findReferences = (definitionName: string) => {
      const definition = definitions[definitionName]
      if (definition && definition.allOf) {
        definition.allOf.forEach(item => {
          // TODO: What if there is an inline definition instead of $ref
          if (item.$ref && item.$ref === reference) {
            log.debug(
              `reference found: ${reference} in definition: ${definitionName}`
            )
            result.add(definitionName)
          }
        })
      }
    }

    for (const definitionName of utils.getKeys(definitions)) {
      findReferences(definitionName)
    }

    return result
  }

  /**
   * Builds the oneOf array of references that comprise of the parent and its children.
   *
   * @param {PolymorphicTree} rootNode- A PolymorphicTree that represents the model in the
   *    inheritance chain.
   * @returns {PolymorphicTree} An array of reference objects that comprise of the
   *    parent and its children.
   */
  private buildOneOfReferences(rootNode: PolymorphicTree): Set<SchemaObject> {
    let result = new Set<SchemaObject>()
    result.add({ $ref: `#/definitions/${rootNode.name}` })
    for (const enObj of rootNode.children.values()) {
      if (enObj) {
        result = new Set([...result, ...this.buildOneOfReferences(enObj)])
      }
    }
    return result
  }
}
