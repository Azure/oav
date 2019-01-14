import * as oav from "../index"
//import * as fs from "fs"
//import * as it from "@ts-common/iterator"
//import * as path from "path"

const f = async () => {
  /*
  const p = [
    "2015-06-15",
    "2016-03-30",
    "2016-06-01",
    "2016-09-01",
    "2016-12-01",
    "2017-03-01",
    "2017-06-01",
    "2017-08-01",
    "2017-09-01",
    "2017-10-01",
    "2017-11-01",

    "2018-01-01",
    "2018-02-01",
    "2018-04-01",
    "2018-06-01",
    "2018-07-01",
    "2018-08-01",
    "2018-10-01",
    "2018-11-01",
  ]

  const getFiles = (aa: ReadonlyArray<string>) => it.flatMap(
    aa,
    dn => {
      const i = path.join(
        // tslint:disable-next-line:max-line-length
        "C:/github.com/Azure/azure-rest-api-specs/specification/network/resource-manager/Microsoft.Network/stable/",
        dn
      )
      return it.flatMap(
        fs.readdirSync(i, { withFileTypes: true }),
        d => d.isDirectory() ? [] : [path.join(i, d.name)]
      )
    }
  )
  */

  for (const swagger of [
    // tslint:disable-next-line:max-line-length
    "C:/github.com/Azure/azure-rest-api-specs/specification/logic/resource-manager/Microsoft.Logic/preview/2018-07-01-preview/logic.json"
  ]) {
    try {
      await oav.validateExamples(swagger, undefined, {consoleLogLevel: 'error', pretty: true});
      oav.clearCache();
    } catch (e) {
      // tslint:disable-next-line:no-console
      console.error("error: ")
      // tslint:disable-next-line:no-console
      console.error(e)
    }
  }
}

const x = f()

// tslint:disable-next-line:no-console
console.log(x)
