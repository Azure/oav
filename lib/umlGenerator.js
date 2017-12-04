// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';

var util = require('util'),
  JsonRefs = require('json-refs'),
  yuml2svg = require('yuml2svg'),
  utils = require('./util/utils'),
  Constants = require('./util/constants'),
  ErrorCodes = Constants.ErrorCodes;

/**
 * @class
 * Generates a Uml Diagaram in svg format.
 */
class UmlGenerator {

  /**
   * @constructor
   * Initializes a new instance of the UmlGenerator class.
   * 
   * @param {object} specInJson the parsed spec in json format
   * 
   * @return {object} An instance of the UmlGenerator class.
   */
  constructor(specInJson, options) {
    if (specInJson === null || specInJson === undefined || typeof specInJson !== 'object') {
      throw new Error('specInJson is a required property of type object')
    }
    this.specInJson = specInJson;
    this.graphDefinition = '';
  }

  generateGraphDefinition() {
    this.generateModelPropertiesGraph();
    this.generateAllOfGraph();
  }

  generateAllOfGraph() {
    let spec = this.specInJson;
    let definitions = spec.definitions;
    for (let modelName in definitions) {
      let model = definitions[modelName];
      if (model.allOf) {
        model.allOf.map((item) => {
          let referencedModel = item;
          let ref = item['$ref'];
          let segments = ref.split('/');
          let parent = segments[segments.length - 1];
          this.graphDefinition += `\n[${parent}]^-.-allOf[${modelName}]`;
        });
      }
    }
  }

  generateModelPropertiesGraph() {
    let spec = this.specInJson;
    let definitions = spec.definitions;
    let references = [];
    for (let modelName in definitions) {
      let model = definitions[modelName];
      let modelProperties = model.properties;
      let props = '';
      let bg = '{bg:cornsilk}';
      if (modelProperties) {
        for (let propertyName in modelProperties) {
          let property = modelProperties[propertyName];
          let propertyType = this.getPropertyType(modelName, property, references);
          let discriminator = '';
          if (model.discriminator && model.discriminator === propertyName) {
            discriminator = '(discriminator)';
          }
          props += `-${propertyName}${discriminator}:${propertyType};`;
        }
      }
      this.graphDefinition += props.length ? `[${modelName}|${props}${bg}]\n` : `[${modelName}${bg}]\n`;

    }
    if (references.length) {
      this.graphDefinition += references.join('\n');
    }
  }

  getPropertyType(modelName, property, references) {
    if (property.type && property.type.match(/^(string|number|boolean)$/i) !== null) {
      return property.type;
    }

    if (property.type === 'array') {
      let result = 'Array<'
      if (property.items) {
        result += this.getPropertyType(modelName, property.items, references);
      }
      result += '>';
      return result;
    }

    if (property['$ref']) {
      let segments = property['$ref'].split('/');
      let referencedModel = segments[segments.length - 1];
      references.push(`[${modelName}]->[${referencedModel}]`);
      return referencedModel;
    }

    if (property.additionalProperties && typeof property.additionalProperties === 'object') {
      let result = 'Dictionary<';
      result += this.getPropertyType(modelName, property.additionalProperties, references);
      result += '>';
      return result;
    }

    if (property.type === 'object') {
      return 'Object'
    }
    return '';
  }

  generateDiagramFromGraph() {
    this.generateGraphDefinition();
    let svg = '';
    try {
      console.log(this.graphDefinition);
      svg = yuml2svg(this.graphDefinition);
      //console.log(svg);
    } catch (err) {
      return Promise.reject(err);
    }
    return Promise.resolve(svg);
  }

  generateInheritanceGraph() {
    let self = this;
    let spec = self.specInJson;
    let definitions = spec.definitions;
    let modelNames = Object.keys(definitions);
    let subTreeMap = new Map();

    modelNames.map((modelName) => {
      if (definitions[modelName].allOf) {
        let rootNode = subTreeMap.get(modelName)
        if (!rootNode) {
          rootNode = utils.createInheritanceTree(spec, modelName, subTreeMap, { discriminator: definitions[modelName].discriminator });
        }
        self.updateReferencesWithOneOf(subTreeMap, references);
      }
    });
  }
}

module.exports = UmlGenerator;