// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var util = require('util'),
  path = require('path'),
  JsonRefs = require('json-refs'),
  utils = require('./util/utils'),
  Constants = require('./util/constants'),
  log = require('./util/logging'),
  ErrorCodes = Constants.ErrorCodes;

/*
 * @class
 * Resolves the swagger spec by unifying x-ms-paths, resolving relative file references if any, 
 * resolving the allof is present in any model definition and then setting additionalProperties 
 * to false if it is not previously set to true or an object in that definition.
 */ 
class SpecResolver {
  
  /*
   * @constructor
   * Initializes a new instance of the SpecResolver class.
   * 
   * @param {string} specPath the (remote|local) swagger spec path
   * 
   * @param {object} specInJson the parsed spec in json format
   * 
   * @return {object} An instance of the SpecResolver class.
   */
  constructor(specPath, specInJson) {
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
  }

  /*
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

  /*
   * Resolves the swagger spec by unifying x-ms-paths, resolving relative file references if any, 
   * resolving the allof is present in any model definition and then setting additionalProperties 
   * to false if it is not previously set to true or an object in that definition.
   */
  resolve() {
    let self = this;
    return self.unifyXmsPaths()
      .then(function() { return self.resolveRelativePaths(); })
      .then(function() { return self.resolveAllOfInDefinitions(); })
      .then(function() { return self.deleteReferencesToAllOf(); })
      .then(function() { return self.setAdditionalPropertiesFalse(); })
      .catch(function (err) {
        let e = {
          message: `An Error occurred while resolving relative references and allOf in model definitions in the swagger spec: "${self.specPath}".`,
          code: ErrorCodes.ResolveSpecError,
          innerErrors: [err]
        };
        log.error(err);
        return Promise.reject(e);
      });
  }

  /*
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

  /*
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
        utils.setObject(doc, slicedRefName, result);
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
          return Promise.resolve(self.resolveRelativePaths(referencedObj, docPath, 'all'));
        } else {
          return Promise.resolve(doc);
        }
      }
    });
  }

  /*
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

  /*
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

  /*
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

  /*
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
}

module.exports = SpecResolver;