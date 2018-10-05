// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as path from "path"
import * as fs from "fs"
import * as md from "@ts-common/commonmark-to-markdown"
import * as amd from "@ts-common/azure-openapi-markdown"
import { isArray } from "@ts-common/iterator"
import { findReadMe } from "@ts-common/azure-openapi-markdown"

export const getSuppressions = (specPath: string): undefined | amd.Suppression => {
  // find readme.md
  const readMe = findReadMe(path.dirname(specPath))
  if (readMe === undefined) {
    return undefined
  }
  const readMeStr = fs.readFileSync(readMe).toString()
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
