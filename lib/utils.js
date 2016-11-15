// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

'use strict';
var fs = require('fs');

// Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
// because the buffer-to-string conversion in `fs.readFile()`
// translates it to FEFF, the UTF-16 BOM.
function stripBOM(content) {
  if (Buffer.isBuffer(content)) {
    content = content.toString();
  }
  if (content.charCodeAt(0) === 0xFEFF || content.charCodeAt(0) === 0xFFFE) {
    content = content.slice(1);
  }
  return content;
}

exports.parseJSONSync = function parseJSONSync(swaggerSpecPath) {
  return JSON.parse(stripBOM(fs.readFileSync(swaggerSpecPath, 'utf8')));
};

exports.run = function run(genfun) {
  // instantiate the generator object
  var gen = genfun();
  // This is the async loop pattern
  function next(err, answer) {
    var res;
    if (err) {
      // if err, throw it into the wormhole
      return gen.throw(err);
    } else {
      // if good value, send it
      res = gen.next(answer);
    }
    if (!res.done) {
      // if we are not at the end
      // we have an async request to
      // fulfill, we do this by calling 
      // `value` as a function
      // and passing it a callback
      // that receives err, answer
      // for which we'll just use `next()`
      res.value(next);
    }
  }
  // Kick off the async loop
  next();
};

exports.constructErrorObject = function constructErrorObject(code, message, innerErrors) {
  let err = {
    code: code,
    message: message,
  }
  if (innerErrors) {
    err.innerErrors = innerErrors;
  }
  return err;
}

exports = module.exports;