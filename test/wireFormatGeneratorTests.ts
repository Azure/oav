// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as should from "should"
import * as path from "path"
import * as glob from "glob"
import * as jsYaml from "js-yaml"

const yamlPaths = glob.sync(path.join(__dirname, "swaggers/**/yaml/*.yml"))

describe("Wireformat generator", () => {
  yamlPaths.forEach((yamlPath: any) => {
    it(`should generate a valid YAML doc for "${yamlPath}."`, (done) => {
      try {
        const yamlContent = jsYaml.safeLoad(yamlPath, { strict: true })
        should.exist(yamlContent)
        done()
      } catch (err) {
        done(err)
      }
    })
  })
})
