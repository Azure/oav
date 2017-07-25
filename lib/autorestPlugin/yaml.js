"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
Object.defineProperty(exports, "__esModule", { value: true });
const yamlAst = require("yaml-ast-parser");
const stable_object_1 = require("./stable-object");
/**
 * reexport required elements
 */
var yaml_ast_parser_1 = require("yaml-ast-parser");
exports.newScalar = yaml_ast_parser_1.newScalar;
exports.Kind = yamlAst.Kind;
exports.CreateYAMLMapping = yamlAst.newMapping;
exports.CreateYAMLScalar = yamlAst.newScalar;
/**
 * Parsing
*/
function ParseToAst(rawYaml) {
  return yamlAst.safeLoad(rawYaml, null);
}
exports.ParseToAst = ParseToAst;
function* Descendants(yamlAstNode, currentPath = [], deferResolvingMappings = false) {
  const todos = [{ path: currentPath, node: yamlAstNode }];
  let todo;
  while (todo = todos.pop()) {
    // report self
    yield todo;
    // traverse
    if (todo.node) {
      switch (todo.node.kind) {
        case exports.Kind.MAPPING:
          {
            let astSub = todo.node;
            if (deferResolvingMappings) {
              todos.push({ node: astSub.value, path: todo.path });
            }
            else {
              todos.push({ node: astSub.value, path: todo.path.concat([astSub.key.value]) });
            }
          }
          break;
        case exports.Kind.MAP:
          if (deferResolvingMappings) {
            for (let mapping of todo.node.mappings) {
              todos.push({ node: mapping, path: todo.path.concat([mapping.key.value]) });
            }
          }
          else {
            for (let mapping of todo.node.mappings) {
              todos.push({ node: mapping, path: todo.path });
            }
          }
          break;
        case exports.Kind.SEQ:
          {
            let astSub = todo.node;
            for (let i = 0; i < astSub.items.length; ++i) {
              todos.push({ node: astSub.items[i], path: todo.path.concat([i]) });
            }
          }
          break;
      }
    }
  }
}
exports.Descendants = Descendants;
function ResolveAnchorRef(yamlAstRoot, anchorRef) {
  for (let yamlAstNode of Descendants(yamlAstRoot)) {
    if (yamlAstNode.node.anchorId === anchorRef) {
      return yamlAstNode;
    }
  }
  throw new Error(`Anchor '${anchorRef}' not found`);
}
exports.ResolveAnchorRef = ResolveAnchorRef;
/**
 * Populates yamlNode.valueFunc with a function that creates a *mutable* object (i.e. no caching of the reference or such)
 */
function ParseNodeInternal(yamlRootNode, yamlNode, onError) {
  if (yamlNode.errors.length > 0) {
    for (const error of yamlNode.errors) {
      onError(`Syntax error: ${error.reason}`, error.mark.position);
    }
    return yamlNode.valueFunc = () => null;
  }
  if (yamlNode.valueFunc) {
    return yamlNode.valueFunc;
  }
  switch (yamlNode.kind) {
    case exports.Kind.SCALAR: {
      const yamlNodeScalar = yamlNode;
      return yamlNode.valueFunc = yamlNodeScalar.valueObject !== undefined
        ? () => yamlNodeScalar.valueObject
        : () => yamlNodeScalar.value;
    }
    case exports.Kind.MAPPING:
      onError("Syntax error: Encountered bare mapping.", yamlNode.startPosition);
      return yamlNode.valueFunc = () => null;
    case exports.Kind.MAP: {
      const yamlNodeMapping = yamlNode;
      return yamlNode.valueFunc = () => {
        const result = stable_object_1.NewEmptyObject();
        for (const mapping of yamlNodeMapping.mappings) {
          if (mapping.key.kind !== exports.Kind.SCALAR) {
            onError("Syntax error: Only scalar keys are allowed as mapping keys.", mapping.key.startPosition);
          }
          else if (mapping.value === null) {
            onError("Syntax error: No mapping value found.", mapping.key.endPosition);
          }
          else {
            result[mapping.key.value] = ParseNodeInternal(yamlRootNode, mapping.value, onError)();
          }
        }
        return result;
      };
    }
    case exports.Kind.SEQ: {
      const yamlNodeSequence = yamlNode;
      return yamlNode.valueFunc = () => yamlNodeSequence.items.map(item => ParseNodeInternal(yamlRootNode, item, onError)());
    }
    case exports.Kind.ANCHOR_REF: {
      const yamlNodeRef = yamlNode;
      return ResolveAnchorRef(yamlRootNode, yamlNodeRef.referencesAnchor).node.valueFunc;
    }
    case exports.Kind.INCLUDE_REF:
      onError("Syntax error: INCLUDE_REF not implemented.", yamlNode.startPosition);
      return yamlNode.valueFunc = () => null;
    default:
      throw new Error("Unknown YAML node kind.");
  }
}
function ParseNode(yamlNode, onError = message => { throw new Error(message); }) {
  ParseNodeInternal(yamlNode, yamlNode, onError);
  return yamlNode.valueFunc();
}
exports.ParseNode = ParseNode;
function CloneAst(ast) {
  if (ast.kind === exports.Kind.MAPPING) {
    const astMapping = ast;
    return exports.CreateYAMLMapping(CloneAst(astMapping.key), CloneAst(astMapping.value));
  }
  return ParseToAst(StringifyAst(ast));
}
exports.CloneAst = CloneAst;
function StringifyAst(ast) {
  return FastStringify(ParseNode(ast));
}
exports.StringifyAst = StringifyAst;
function Clone(object) {
  return Parse(FastStringify(object));
}
exports.Clone = Clone;
function ToAst(object) {
  return ParseToAst(FastStringify(object));
}
exports.ToAst = ToAst;
function Parse(rawYaml, onError = message => { throw new Error(message); }) {
  const node = ParseToAst(rawYaml);
  const result = ParseNode(node, onError);
  return result;
}
exports.Parse = Parse;
function Stringify(object) {
  return "---\n" + yamlAst.safeDump(object, { skipInvalid: true });
}
exports.Stringify = Stringify;
function FastStringify(obj) {
  try {
    return JSON.stringify(obj, null, 1);
  }
  catch (e) {
    return Stringify(obj);
  }
}
exports.FastStringify = FastStringify;
