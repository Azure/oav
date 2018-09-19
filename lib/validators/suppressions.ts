// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as path from "path"
import * as fs from "fs"
import * as md from "@ts-common/commonmark-to-markdown"
import * as amd from "@ts-common/azure-openapi-markdown"

export const getSuppressions = (specPath: string): undefined | string => {
  // find readme.md
  const readMe = findReadMe(path.dirname(specPath))
  if (readMe === undefined) {
    return undefined
  }
  const readMeStr = fs.readFileSync(readMe).toString()
  const cmd = md.parse(readMeStr)
  const codeBlocks = amd.getCodeBlocksAndHeadings(cmd.markDown)
  if (codeBlocks === undefined) {
    return undefined
  }
  // codeBlocks.Suppression
  return undefined
}

const findReadMe = (dir: string): string | undefined => {
  dir = path.resolve(dir)
  while (true) {
    const fileName = path.join(dir, "readme.md")
    if (fs.existsSync(fileName)) {
      return fileName
    }
    const newDir = path.dirname(dir)
    if (newDir === dir) {
      return undefined
    }
    dir = newDir
  }
}
