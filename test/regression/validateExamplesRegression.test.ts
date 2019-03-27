import glob = require("glob")
import * as _ from "lodash"
import md5File = require("md5-file")
import * as path from "path"

import * as validate from "../../lib/validate"

describe("validateExamples should not regress for file", () => {
  const specPaths = glob
    .sync(path.join(__dirname, "azure-rest-api-specs/specification/**/*.json"))
    .filter(p => !p.includes("examples"))

  const versionRegex = /[0-9]+[0-9-]+[^\/]*/
  const rpRegex = /(?:\/)Microsoft.[^\/]*/
  const latestForEachRp = (_.chain(specPaths)
    .filter(p => p.includes("stable")) // only look at stable specs
    .filter(p => p.match(rpRegex))
    .groupBy((p: string) => p.match(rpRegex)![0]) // group paths by rp
    .entries()
    .map((entry: [string, string[]]) =>
      // for each rp get latest version
      _.chain(entry[1])
        .filter(p => p!.match(versionRegex))
        .groupBy((p: string) => p!.match(versionRegex)![0])
        .entries()
        .sortBy(([version]: [string, string[]]) => version)
        .map((e: [string, string[]]) => e[1])
        .last()
        .value()
    )
    .flatten()
    .value() as unknown) as string[]

  test.each(specPaths.map(path => [path, latestForEachRp.includes(path) ? "@latestVersion" : ""]))(
    "'%s' %s",
    async file => {
      try {
        const hash = await new Promise(resolve =>
          md5File(file, (e, h) => {
            if (e) {
              throw e
            }
            resolve(h)
          })
        )
        expect(hash).toMatchSnapshot("input file hash")

        const result = await validate.validateExamples(file, undefined, {
          pretty: true
        })
        expect(result).toMatchSnapshot("returned results")
      } catch (e) {
        expect(e).toMatchSnapshot("thrown exception")
      }
    },
    999999
  )
})
