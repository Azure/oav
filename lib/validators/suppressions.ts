// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as amd from "@azure/openapi-markdown"
import * as md from "@ts-common/commonmark-to-markdown"
import { isArray } from "@ts-common/iterator"
import * as vfs from "@ts-common/virtual-fs"
import * as path from "path"

export const getSuppressions = async (specPath: string): Promise<undefined | amd.Suppression> => {
  // find readme.md
  const readMe = await amd.findReadMe(path.dirname(specPath))
  if (readMe === undefined) {
    return undefined
  }
  const readMeStr = await vfs.readFile(readMe)
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
