// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

import * as amd from "@azure/openapi-markdown"
import * as md from "@ts-common/commonmark-to-markdown"
import * as it from "@ts-common/iterator"
import * as vfs from "@ts-common/virtual-fs"
import * as path from "path"
import { isSubPath, splitPathAndReverse } from "../util/path"

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
  if (!it.isArray(suppression.directive)) {
    return undefined
  }
  return suppression
}

export function existSuppression(
  specPath: string,
  suppression: amd.Suppression,
  id: string
): boolean {
  if (suppression.directive !== undefined) {
    const suppressionArray = getSuppressionArray(specPath, suppression.directive)
    for (const s of suppressionArray) {
      if (s.suppress === id) {
        return true
      }
    }
  }
  return false
}

const getSuppressionArray = (
  specPath: string,
  suppressionItems: ReadonlyArray<amd.SuppressionItem>
): ReadonlyArray<amd.SuppressionItem> => {
  const urlReversed = splitPathAndReverse(specPath)
  return suppressionItems.filter(s =>
    it.some(it.isArray(s.from) ? s.from : [s.from], from =>
      isSubPath(urlReversed, splitPathAndReverse(from))
    )
  )
}
