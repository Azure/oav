// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var util = require('util'),
  path = require('path'),
  JsonRefs = require('json-refs'),
  utils = require('../util/utils'),
  Constants = require('../util/constants'),
  log = require('../util/logging'),
  ErrorCodes = Constants.ErrorCodes;

/**
 * @class
 * Resolves the swagger spec by unifying x-ms-paths, resolving relative file references if any, 
 * resolving the allof is present in any model definition and then setting additionalProperties 
 * to false if it is not previously set to true or an object in that definition.
 */
class SpecResolver {

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
   * @param {object} [options.shouldResolveRelativePaths] Should relative pathes be resolved? Default: true
   * 
   * @param {object} [options.shouldResolveXmsExamples] Should x-ms-examples be resolved? Default: true. 
   * If options.shouldResolveRelativePaths is false then this option will also be false implicitly and cannot be overridden.
   * 
   * @param {object} [options.shouldResolveAllOf] Should allOf references be resolved? Default: true
   * 
   * @param {object} [options.shouldResolveDiscriminator] Should discriminator be resolved? Default: true
   * 
   * @param {object} [options.shouldSetAdditionalPropertiesFalse] Should additionalProperties be set to false? Default: true
   * 
   * @param {object} [options.shouldResolvePureObjects] Should pure objects be resolved? Default: true
   * 
   * @return {object} An instance of the SpecResolver class.
   */
  constructor(specPath, specInJson, options) {
    if (specPath === null || specPath === undefined || typeof specPath.valueOf() !== 'string' || !specPath.trim().length) {
      throw new Error('specPath is a required property of type string and it cannot be an empty string.')
    }

    if (specInJson === null || specInJson === undefined || typeof specInJson !== 'object') {
      throw new Error('specInJson is a required property of type object')
    }
    this.specInJson = specInJson;
    this.specPath = specPath;
    this.specDir = path.dirname(this.specPath);
    this.visitedEntities = {};
    this.resolvedAllOfModels = {};
    if (!options) options = {};
    if (options.shouldResolveRelativePaths === null || options.shouldResolveRelativePaths === undefined) {
      options.shouldResolveRelativePaths = true;
    }
    if (options.shouldResolveXmsExamples === null || options.shouldResolveXmsExamples === undefined) {
      options.shouldResolveXmsExamples = true;
    }
    if (options.shouldResolveAllOf === null || options.shouldResolveAllOf === undefined) {
      options.shouldResolveAllOf = true;
    }
    if (options.shouldSetAdditionalPropertiesFalse === null || options.shouldSetAdditionalPropertiesFalse === undefined) {
      options.shouldSetAdditionalPropertiesFalse = true;
    }
    if (options.shouldResolvePureObjects === null || options.shouldResolvePureObjects === undefined) {
      options.shouldResolvePureObjects = true;
    }
    if (options.shouldResolveDiscriminator === null || options.shouldResolveDiscriminator === undefined) {
      options.shouldResolveDiscriminator = true;
    }

    // Resolving allOf is a neccessary precondition for resolving discriminators. Hence hard setting this to true
    if (options.shouldResolveDiscriminator) {
      options.shouldResolveAllOf = true;
    }

    this.options = options;
  }

  /**
   * Merges the x-ms-paths object into the paths object in swagger spec. The method assumes that the 
   * paths present in "x-ms-paths" and "paths" are unique. Hence it does a simple union.
   */
  unifyXmsPaths() {
    let self = this;
    //unify x-ms-paths into paths
    let xmsPaths = self.specInJson['x-ms-paths'];
    let paths = self.specInJson.paths;
    if (xmsPaths && xmsPaths instanceof Object && Object.keys(xmsPaths).length > 0) {
      for (let property in xmsPaths) {
        paths[property] = xmsPaths[property];
      }
      self.specInJson.paths = utils.mergeObjects(xmsPaths, paths);
    }
    return Promise.resolve(self);
  }

  /**
   * Resolves the swagger spec by unifying x-ms-paths, resolving relative file references if any, 
   * resolving the allof is present in any model definition and then setting additionalProperties 
   * to false if it is not previously set to true or an object in that definition.
   */
  resolve() {
    let self = this;
    return self.unifyXmsPaths().then(() => {
      if (self.options.shouldResolveRelativePaths) {
        return self.resolveRelativePaths();
      } else {
        return Promise.resolve(self);
      }
    }).then(() => {
      if (self.options.shouldResolveAllOf) {
        return self.resolveAllOfInDefinitions();
      } else {
        return Promise.resolve(self);
      }
    }).then(() => {
      if (self.options.shouldResolveDiscriminator) {
        return self.resolveDiscriminator();
      } else {
        return Promise.resolve(self);
      }
    }).then(() => {
      if (self.options.shouldResolveAllOf) {
        return self.deleteReferencesToAllOf();
      } else {
        return Promise.resolve(self);
      }
    }).then(() => {
      if (self.options.shouldSetAdditionalPropertiesFalse) {
        return self.setAdditionalPropertiesFalse();
      } else {
        return Promise.resolve(self);
      }
    }).then(() => {
      if (self.options.shouldResolvePureObjects) {
        return self.resolvePureObjects();
      } else {
        return Promise.resolve(self);
      }
    }).catch(function (err) {
      let e = {
        message: `An Error occurred while resolving relative references and allOf in model definitions in the swagger spec: "${self.specPath}".`,
        code: ErrorCodes.ResolveSpecError.name,
        id: ErrorCodes.ResolveSpecError.id,
        innerErrors: [err]
      };
      log.error(err);
      return Promise.reject(e);
    });
  }

  /**
   * Resolves the references to relative paths in the provided object.
   * 
   * @param {object} [doc] the json doc that contains relative references. Default: self.specInJson (current swagger spec).
   * 
   * @param {string} [docPath] the absolute (local|remote) path of the doc Default: self.specPath (current swagger spec path). 
   * 
   * @param {string} [filterType] the type of paths to filter. By default the method will resolve 'relative' and 'remote' references. 
   * If provided the value should be 'all'. This indicates that 'local' references should also be resolved apart from the default ones.
   * 
   * @return {object} doc fully resolved json document
   */
  resolveRelativePaths(doc, docPath, filterType) {
    let self = this;
    let docDir;
    let options = {
      relativeBase: docDir,
      filter: ['relative', 'remote']
    };

    if (!doc) {
      doc = self.specInJson;
    }
    if (!docPath) {
      docPath = self.specPath;
      docDir = self.specDir;
    }
    if (!docDir) {
      docDir = path.dirname(docPath);
    }
    if (filterType === 'all') {
      delete options.filter;
    }

    let allRefsRemoteRelative = JsonRefs.findRefs(doc, options);
    let promiseFactories = Object.keys(allRefsRemoteRelative).map(function (refName) {
      let refDetails = allRefsRemoteRelative[refName];
      return function () { return self.resolveRelativeReference(refName, refDetails, doc, docPath); };
    });
    if (promiseFactories.length) {
      return utils.executePromisesSequentially(promiseFactories);
    } else {
      return Promise.resolve(doc);
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
  resolveRelativeReference(refName, refDetails, doc, docPath) {
    if (!refName || (refName && typeof refName.valueOf() !== 'string')) {
      throw new Error('refName cannot be null or undefined and must be of type "string".');
    }

    if (!refDetails || (refDetails && !(refDetails instanceof Object))) {
      throw new Error('refDetails cannot be null or undefined and must be of type "object".');
    }

    if (!doc || (doc && !(doc instanceof Object))) {
      throw new Error('doc cannot be null or undefined and must be of type "object".');
    }

    if (!docPath || (docPath && typeof docPath.valueOf() !== 'string')) {
      throw new Error('docPath cannot be null or undefined and must be of type "string".');
    }

    let self = this;
    let node = refDetails.def;
    let slicedRefName = refName.slice(1);
    let reference = node['$ref'];
    let parsedReference = utils.parseReferenceInSwagger(reference);
    let docDir = path.dirname(docPath);

    if (parsedReference.filePath) {
      //assuming that everything in the spec is relative to it, let us join the spec directory 
      //and the file path in reference.
      docPath = utils.joinPath(docDir, parsedReference.filePath);
    }

    return utils.parseJson(docPath).then(function (result) {
      if (!parsedReference.localReference) {
        //Since there is no local reference we will replace the key in the object with the parsed 
        //json (relative) file it is refering to.
        let regex = /.*x-ms-examples.*/ig;
        if (self.options.shouldResolveXmsExamples || (!self.options.shouldResolveXmsExamples && slicedRefName.match(regex) === null)) {
          utils.setObject(doc, slicedRefName, result);
        }
        return Promise.resolve(doc);
      } else {
        //resolve the local reference.
        //make the reference local to the doc being processed
        node['$ref'] = parsedReference.localReference.value;
        utils.setObject(doc, slicedRefName, node);
        let slicedLocalReferenceValue = parsedReference.localReference.value.slice(1);
        let referencedObj = self.visitedEntities[slicedLocalReferenceValue];
        if (!referencedObj) {
          //We get the definition/parameter from the relative file and then add it (make it local) 
          //to the doc (i.e. self.specInJson) being processed.
          referencedObj = utils.getObject(result, slicedLocalReferenceValue);
          utils.setObject(self.specInJson, slicedLocalReferenceValue, referencedObj);
          self.visitedEntities[slicedLocalReferenceValue] = referencedObj;
          return self.resolveRelativePaths(referencedObj, docPath, 'all').then(() => {
            //After resolving a model definition, if there are models that have an allOf on that model definition
            //It may be possible that those models are not being referenced anywhere. Hence, we must ensure
            //that they are consumed as well. Example model "CopyActivity" in file 
            //arm-datafactory/2017-03-01-preview/swagger/entityTypes/Pipeline.json is having an allOf on model
            //"Activity". Spec "datafactory.json" has references to "Activity" in Pipeline.json but there are no 
            //references to "CopyActivity". The following code, ensures that we do not forget such models while
            //resolving relative swaggers.
            if (result && result.definitions) {
              let unresolvedDefinitions = [];
              for (let defName in result.definitions) {
                unresolvedDefinitions.push(() => {
                  if (result.definitions[defName].allOf) {
                    let matchFound = result.definitions[defName].allOf.some((item) => {
                      return (!self.visitedEntities[`/definitions/${defName}`]);
                    });
                    if (matchFound) {
                      let slicedDefinitionRef = `/definitions/${defName}`;
                      let definitionObj = result.definitions[defName];
                      utils.setObject(self.specInJson, slicedDefinitionRef, definitionObj);
                      self.visitedEntities[slicedDefinitionRef] = definitionObj;
                      return self.resolveRelativePaths(definitionObj, docPath, 'all');
                    }
                    return Promise.resolve();
                  }
                });
              }
              return utils.executePromisesSequentially(unresolvedDefinitions);
            }
            return Promise.resolve();
          });
        } else {
          return Promise.resolve(doc);
        }
      }
    });
  }

  /**
   * Resolves the "allOf" array present in swagger model definitions by composing all the properties of the parent model into the child model.
   */
  resolveAllOfInDefinitions() {
    let self = this;
    let spec = self.specInJson;
    let definitions = spec.definitions;
    let modelNames = Object.keys(self.specInJson.definitions);
    modelNames.map(function (modelName) {
      let model = definitions[modelName];
      let modelRef = '/definitions/' + modelName;
      return self.resolveAllOfInModel(model, modelRef);
    });
    return Promise.resolve(self);
  }

  /**
   * Resolves the "allOf" array present in swagger model definitions by composing all the properties of the parent model into the child model.
   */
  resolveAllOfInModel(model, modelRef) {
    let self = this;
    let spec = self.specInJson;
    if (!model || (model && typeof model !== 'object')) {
      throw new Error(`model cannot be null or undefined and must of type "object".`);
    }

    if (!modelRef || (modelRef && typeof modelRef.valueOf() !== 'string')) {
      throw new Error(`model cannot be null or undefined and must of type "string".`);
    }

    if (modelRef.startsWith('#')) modelRef = modelRef.slice(1);

    if (!self.resolvedAllOfModels[modelRef]) {
      if (model && model.allOf) {
        model.allOf.map(function (item) {
          let referencedModel = item;
          let ref = item['$ref'];
          let slicedRef = ref ? ref.slice(1) : undefined;
          if (ref) {
            referencedModel = utils.getObject(spec, slicedRef);
          }
          if (referencedModel.allOf) {
            self.resolveAllOfInModel(referencedModel, slicedRef);
          }
          model = self.mergeParentAllOfInChild(referencedModel, model);
          self.resolvedAllOfModels[slicedRef] = referencedModel;
          return model;
        });
      } else {
        self.resolvedAllOfModels[modelRef] = model;
        return model;
      }
    }
  }

  /**
   * Merges the properties of the parent model into the child model.
   * 
   * @param {object} parent object to be merged. Example: "Resource".
   * 
   * @param {object} child object to be merged. Example: "Storage".
   * 
   * @return {object} returns the merged child oject
   */
  mergeParentAllOfInChild(parent, child) {
    let self = this;
    if (!parent || (parent && typeof parent !== 'object')) {
      throw new Error(`parent must be of type "object".`);
    }
    if (!child || (child && typeof child !== 'object')) {
      throw new Error(`child must be of type "object".`);
    }
    //merge the parent (Resource) model's properties into the properties 
    //of the child (StorageAccount) model.
    if (!parent.properties) parent.properties = {};
    if (!child.properties) child.properties = {};
    child.properties = utils.mergeObjects(parent.properties, child.properties);
    //merge the array of required properties
    if (parent.required) {
      if (!child.required) {
        child.required = [];
      }
      child.required = [...new Set([...parent.required, ...child.required])];
    }
    //merge x-ms-azure-resource
    if (parent['x-ms-azure-resource']) {
      child['x-ms-azure-resource'] = parent['x-ms-azure-resource'];
    }
    return child;
  }

  /**
   * Deletes all the references to allOf from all the model definitions in the swagger spec.
   */
  deleteReferencesToAllOf() {
    let self = this;
    let spec = self.specInJson;
    let definitions = spec.definitions;
    let modelNames = Object.keys(definitions);
    modelNames.map(function (modelName) {
      if (definitions[modelName].allOf) {
        delete definitions[modelName].allOf;
      }
    });
    return Promise.resolve(self);
  }

  /*
   * Sets additionalProperties of the given modelNames to false.
   * 
   * @param {array} [modelNames] An array of strings that specifies the modelNames to be processed.
   * Default: All the modelnames from the definitions section in the swagger spec.
   * 
   * @param {boolean} [force] A boolean value that indicates whether to ignore the additionalProperties
   * set to true or an object and forcefully set it to false. Default: false.
   */
  setAdditionalPropertiesFalse(modelNames, force) {
    let self = this;
    let spec = self.specInJson;
    let definitions = spec.definitions;

    if (!modelNames) {
      modelNames = Object.keys(definitions);
    }
    modelNames.forEach(function iterator(modelName) {
      let model = definitions[modelName];
      if (model) {
        if (force || (!model.additionalProperties && (!(!model.properties || (model.properties && Object.keys(model.properties).length === 0))))) {
          model.additionalProperties = false;
        }
      }
    });
    return Promise.resolve(self);
  }

  /**
   * Resolves entities (parameters, definitions, model properties, etc.) in the spec that are true ojects.
   * i.e `"type": "object"` and `"properties": {}` or `"properties"` is absent or the entity has 
   * "additionalProperties": { "type": "object" }.
   */
  resolvePureObjects() {
    let self = this;
    let spec = self.specInJson;
    let definitions = spec.definitions;

    //scan definitions and properties of every model in definitions
    for (let defName in definitions) {
      let model = definitions[defName];
      utils.relaxModelLikeEntities(model);
    }

    //scan every operation
    for (let path in spec.paths) {
      let pathObj = spec.paths[path];
      for (let verb in pathObj) {
        let operation = pathObj[verb];
        //scan every parameter in the operation
        if (operation.parameters) {
          operation.parameters.forEach((param) => {
            if (param.in && param.in === 'body' && param.schema) {
              param.schema = utils.relaxModelLikeEntities(param.schema);
            } else {
              param = utils.relaxEntityType(param, param.required);
            }
          });
        }
        //scan every response in the operation
        if (operation.responses) {
          for (let statusCode in operation.responses) {
            let response = operation.responses[statusCode];
            if (response.schema) {
              response.schema = utils.relaxModelLikeEntities(response.schema);
            }
          }
        }
      }
      //scan path level parameters if any
      if (pathObj.parameters) {
        pathObj.parameters.forEach((param) => {
          if (param.in && param.in === 'body' && param.schema) {
            param.schema = utils.relaxModelLikeEntities(param.schema);
          } else {
            param = utils.relaxEntityType(param, param.required);
          }
        });
      }
    }
    //scan global parameters
    for (let param in spec.parameters) {
      if (spec.parameters[param].in && spec.parameters[param].in === 'body' && spec.parameters[param].schema) {
        spec.parameters[param].schema = utils.relaxModelLikeEntities(spec.parameters[param].schema);
      }
      spec.parameters[param] = utils.relaxEntityType(spec.parameters[param], spec.parameters[param].required);
    }
    return Promise.resolve(self);
  }

  /**
   * Resolves the discriminator by replacing all the references to the parent model with a oneOf array containing
   * references to the parent model and all its child models. It also modifies the discriminator property in
   * the child models by making it a constant (enum with one value) with the value expected for that model
   * type on the wire.
   * For example: There is a model named "Animal" with a discriminator as "animalType". Models like "Cat", "Dog",
   * "Tiger" are children (having "allof": [ { "$ref": "#/definitions/Animal" } ] on) of "Animal" in the swagger spec.
   *
   * - This method will replace all the locations in the swagger spec that have a reference to the
   * parent model "Animal" ("$ref": "#/definitions/Animal") except the allOf reference with a oneOf reference 
   * "oneOf": [ { "$ref": "#/definitions/Animal" }, { "$ref": "#/definitions/Cat" }, { "$ref": "#/definitions/Dog" }, { "$ref": "#/definitions/Tiger" } ]
   *
   * - It will also add a constant value (name of that animal on the wire or the value provided by "x-ms-discriminator-value")
   * to the discrimiantor property "animalType" for each of the child models.
   * For example:  the Cat model's discriminator property will look like:
   * "Cat": { "required": [ "animalType" ], "properties": { "animalType": { "type": "string", "enum": [ "Cat" ] },  . . } }.
   */
  resolveDiscriminator() {
    let self = this;
    let spec = self.specInJson;
    let definitions = spec.definitions;
    let modelNames = Object.keys(definitions);
    let subTreeMap = new Map();
    let references = JsonRefs.findRefs(spec);

    modelNames.map((modelName) => {
      if (definitions[modelName].discriminator) {
        let modelReference = `#/definitions/${modelName}`;
        let rootNode = subTreeMap.get(modelName)
        if (!rootNode) {
          rootNode = self.createPolymorphicTree(modelName, definitions[modelName].discriminator, subTreeMap);
        }
        self.updateReferencesWithOneOf(subTreeMap, references);
      }
    });

    return Promise.resolve(self);
  }

  /**
   * Updates the reference to a parent node with a oneOf array containing a reference to the parent and all its children.
   * 
   * @param {Map<string, PolymorphicTree>} subTreeMap - A map containing a reference to a node in the PolymorhicTree.
   * @param {object} references - This object is the output of findRefs function from "json-refs" library. Please refer 
   * to the documentation of json-refs over [here](https://github.com/whitlockjc/json-refs/blob/master/docs/API.md#jsonrefsunresolvedrefdetails--object)
   * for detailed structure of the object.
   */
  updateReferencesWithOneOf(subTreeMap, references) {
    let spec = this.specInJson;
    let definitions = spec.definitions;

    for (const node of subTreeMap.values()) {
      // Have to process all the non-leaf nodes only
      if (node.children.size > 0) {
        let locationsToBeUpdated = [];
        let modelReference = `#/definitions/${node.name}`;
        // Create a list of all the locations where the current node is referenced
        for (let key in references) {
          if (references[key].uri === modelReference && key.indexOf("allOf") === -1 && key.indexOf("oneOf") === -1) locationsToBeUpdated.push(key);
        }
        // Replace the reference to that node in that location with a oneOf array
        // containing reference to the node and all its children.
        for (let location of locationsToBeUpdated) {
          const slicedLocation = location.slice(1);
          let obj = utils.getObject(spec, slicedLocation);
          if (obj) {
            if (obj['$ref']) delete obj['$ref'];
            obj.oneOf = [...this.buildOneOfReferences(node)];
            utils.setObject(spec, slicedLocation, obj);
          }
        }
      }
    }
    return;
  }

  /**
   * Creates a PolymorphicTree for a given model in the inheritance chain
   *
   * @param {string} name- Name of the model for which the tree needs to be created.
   * @param {string} discriminator- Name of the property that is marked as the discriminator.
   * @param {Map<string, PolymorphicTree>} subTreeMap- A map that stores a reference to PolymorphicTree for a given model in the inheritance chain.
   * @returns {PolymorphicTree} rootNode- A PolymorphicTree that represents the model in the inheritance chain.
   */
  createPolymorphicTree(name, discriminator, subTreeMap) {
    if (name === null || name === undefined || typeof name.valueOf() !== 'string' || !name.trim().length) {
      throw new Error('name is a required property of type string and it cannot be an empty string.')
    }

    if (discriminator === null || discriminator === undefined || typeof discriminator.valueOf() !== 'string' || !discriminator.trim().length) {
      throw new Error('discriminator is a required property of type string and it cannot be an empty string.')
    }

    if (subTreeMap === null || subTreeMap === undefined || !(subTreeMap instanceof Map)) {
      throw new Error('subTreeMap is a required property of type Map.')
    }

    let rootNode = new PolymorphicTree(name);
    let definitions = this.specInJson.definitions;

    // Adding the model name or it's discriminator value as an enum constraint with one value (constant) on property marked as discriminator
    if (definitions[name] && definitions[name].properties && definitions[name].properties[discriminator]) {
      let val = name;
      if (definitions[name]['x-ms-discriminator-value']) {
        val = definitions[name]['x-ms-discriminator-value'];
      }
      definitions[name].properties[discriminator].enum = [`${val}`];
    }

    let children = this.findChildren(name);
    for (let childName of children) {
      let childObj = this.createPolymorphicTree(childName, discriminator, subTreeMap);
      rootNode.addChildByObject(childObj);
    }
    //Adding the created sub tree in the subTreeMap for future use.
    subTreeMap.set(rootNode.name, rootNode);
    return rootNode;
  }

  /**
   * Finds children of a given model in the inheritance chain.
   *
   * @param {string} name- Name of the model for which the children need to be found.
   * @returns {Set} result- A set of model names that are the children of the given model in the inheritance chain.
   */
  findChildren(name) {
    if (name === null || name === undefined || typeof name.valueOf() !== 'string' || !name.trim().length) {
      throw new Error('name is a required property of type string and it cannot be an empty string.')
    }
    let definitions = this.specInJson.definitions;
    let reference = `#/definitions/${name}`;
    let result = new Set();
    for (let definitionName of Object.keys(definitions)) {
      let definition = definitions[definitionName];
      if (definition && definition.allOf) {
        definition.allOf.forEach((item) => {
          //TODO: What if there is an inline definition instead of $ref
          if (item['$ref'] && item['$ref'] === reference) {
            log.debug(`reference found: ${reference} in definition: ${definitionName}`);
            result.add(definitionName);
          }
        });
      }
    }
    return result;
  }

  /**
   * Builds the oneOf array of references that comprise of the parent and its children.
   *
   * @param {PolymorphicTree} rootNode- A PolymorphicTree that represents the model in the inheritance chain.
   * @returns {PolymorphicTree} result- An array of reference objects that comprise of the parent and its children.
   */
  buildOneOfReferences(rootNode) {
    let result = new Set();
    result.add({ "$ref": `#/definitions/${rootNode.name}` });
    for (let entry of rootNode.children.entries()) {
      if (entry[1]) {
        result = new Set([...result, ...this.buildOneOfReferences(entry[1])]);
      }
    }
    return result;
  }
}

/**
 * @class
 * Creates a tree by traversing the definitions where the parent model is the rootNode and child model is one of it's children.
 */
class PolymorphicTree {
  /**
   * @constructor
   * Initializes a new instance of the PolymorphicTree
   *
   * @param {string} name- The name of the parent model
   * @param {Map<string, PolymorphicTree>} [children] - A map of zero or more children representing the child models in the inheritance chain
   */
  constructor(name, children) {
    if (name === null || name === undefined || typeof name.valueOf() !== 'string' || !name.trim().length) {
      throw new Error('name is a required property of type string and it cannot be an empty string.')
    }

    if (children !== null && children !== undefined && !children instanceof Map) {
      throw new Error('children is an optional property of type Map<string, PolymorphicTree>.')
    }
    this.name = name;
    this.children = children || new Map();
  }

  /**
   * Adds a child by name to the PolymorphicTree. This method will not add the child again if it is already present.
   *
   * @param {string} childName- The name of the child model
   * @returns {PolymorphicTree} child - The created child node.
   */
  addChildByName(childName) {
    if (childName === null || childName === undefined || typeof childName.valueOf() === 'string' || !childName.trim().length) {
      throw new Error('childName is a required parameter of type string.')
    }
    let child;
    if (!this.children.has(childName)) {
      child = new PolymorphicTree(childName);
      this.children.set(childName, child);
    } else {
      child = this.children.get(childName);
    }
    return child;
  }

  /**
   * Adds a childObject to the PolymorphicTree. This method will not add the child again if it is already present.
   *
   * @param {PolymorphicTree} childObj- A polymorphicTree representing the child model.
   * @returns {PolymorphicTree} childObj - The created child node.
   */
  addChildByObject(childObj) {
    if (childObj === null || childObj === undefined || !(childObj instanceof PolymorphicTree)) {
      throw new Error('childObj is a required parameter of type PolymorphicTree.')
    }

    if (!this.children.has(childObj.name)) {
      this.children.set(childObj.name, childObj);
    }
    return childObj;
  }
}
module.exports = SpecResolver;