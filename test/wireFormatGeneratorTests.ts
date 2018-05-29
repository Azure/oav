import should = require('should')
import path = require('path')
import glob = require('glob')
import jsYaml = require('js-yaml')

const yamlPaths = glob.sync(path.join(__dirname, 'swaggers/**/yaml/*.yml'))

describe('Wireformat generator', () => {
  yamlPaths.forEach((yamlPath: any) => {
    it(`should generate a valid YAML doc for "${yamlPath}."`, (done) => {
      try {
        let yamlContent = jsYaml.safeLoad(yamlPath, { strict: true })
        should.exist(yamlContent)
        done()
      } catch (err) {
        done(err)
      }
    })
  })
})