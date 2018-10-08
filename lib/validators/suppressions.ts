// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as path from "path"
import * as fs from "fs"
import * as md from "@ts-common/commonmark-to-markdown"
import * as amd from "@ts-common/azure-openapi-markdown"
import { isArray } from "@ts-common/iterator"
import { findReadMe, urlParse } from "@ts-common/azure-openapi-markdown"

// tslint:disable-next-line:promise-function-async
const fsReadFile = (pathStr: string): Promise<Buffer> =>
  new Promise((resolve, reject) => fs.readFile(
    pathStr,
    (err, data) => {
      if (err) {
        reject(err)
      }
      resolve(data)
    }))

const readFile = async (pathStr: string): Promise<string> => {
  const result = urlParse(pathStr)
  return result === undefined ?
    (await fsReadFile(pathStr)).toString() :
    (await amd.httpsGet(pathStr)).read()
}

export const getSuppressions = async (specPath: string): Promise<undefined | amd.Suppression> => {
  // find readme.md
  const readMe = await findReadMe(path.dirname(specPath))
  if (readMe === undefined) {
    return undefined
  }
  const readMeStr = await readFile(readMe)
  const cmd = md.parse(readMeStr)
  const suppressionCodeBlock = amd.getCodeBlocksAndHeadings(cmd.markDown).Suppression
  if (suppressionCodeBlock === undefined) {
    return undefined
  }
  const suppression = amd.getYamlFromNode(suppressionCodeBlock) as amd.Suppression
  if (!isArray(suppression.directive)) {
    return undefined
  }
  return suppression
}
