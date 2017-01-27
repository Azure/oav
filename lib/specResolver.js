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

class SpecResolver {

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

  resolve() {
    let self = this;
    return self.unifyXmsPaths()
      .then(function() { return self.resolveRelativePaths(); })
      .then(function() { self.resolveAllOfInDefinitions(); })
      .then(function() { self.deleteReferencesToAllOf(); })
      .then(function() { self.setAdditionalPropertiesFalse(); });
  }

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
      return function () { return self.resolveRelativeReference(refName, refDetails, docPath); };
    });
    if (promiseFactories.length) {
      return utils.executePromisesSequentially(promiseFactories);
    } else {
      return Promise.resolve();
    }
  }

  resolveRelativeReference(refName, refDetails, docPath) {
    let self = this;
    if (!docPath) {
      docPath = self.specPath;
    }
    let node = refDetails.def;
    let slicedRefName = refName.slice(1);
    let reference = node['$ref'];
    let parsedReference = utils.parseReferenceInSwagger(reference);
    
    if (parsedReference.filePath) {
      //assuming that everything in the spec is relative to it, let us join the spec directory and the file path in reference.
      docPath = utils.joinPath(self.specDir, parsedReference.filePath);
    }
    return utils.parseJson(docPath).then(function (result) {
      if (!parsedReference.localReference) {
        //Since there is no local reference we will replace the key in the object with the parsed json (relative) file it is refering to.
        return Promise.resolve(utils.setObject(self.specInJson, slicedRefName, result));
      } else {
        //resolve the local reference.
        //make the reference local to the doc being processed
        node['$ref'] = parsedReference.localReference.value;
        utils.setObject(self.specInJson, slicedRefName, node);
        let slicedLocalReferenceValue = parsedReference.localReference.value.slice(1);
        let referencedObj = self.visitedEntities[slicedLocalReferenceValue];
        if (!referencedObj) {
          //We get the definition/parameter from the relative file and then add it (make it local) to the doc being processed.
          referencedObj = utils.getObject(result, slicedLocalReferenceValue);
          utils.setObject(self.specInJson, slicedLocalReferenceValue, referencedObj);
          self.visitedEntities[slicedLocalReferenceValue] = referencedObj;
          return Promise.resolve(self.resolveRelativePaths(referencedObj, docPath, 'all'));
        } else {
          return Promise.resolve();
        }
      }
    });
  }

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

  mergeParentAllOfInChild(source, target) {
    let self = this;
    if (!source || (source && typeof source !== 'object')) {
      throw new Error(`source must be of type "object".`);
    }
    if (!target || (target && typeof target !== 'object')) {
      throw new Error(`target must be of type "object".`);
    }
    //merge the source (Resource) model's properties into the properties 
    //of the target (StorageAccount) model.
    target.properties = utils.mergeObjects(source.properties, target.properties);
    //merge the array of required properties
    if (source.required) {
      if (!target.required) {
        target.required = [];
      }
      target.required = [...new Set([...source.required, ...target.required])];
    }
    //merge x-ms-azure-resource
    if (source['x-ms-azure-resource']) {
      target['x-ms-azure-resource'] = source['x-ms-azure-resource'];
    }
    return target;
  }

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
        if (!model.additionalProperties || force) {
          model.additionalProperties = false;
        }
      }
    });
    return Promise.resolve(self);
  }
}

module.exports = SpecResolver;