// Copyright (c) 2021 Microsoft Corporation
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { load } from "js-yaml";
import { inject, injectable } from "inversify";
import * as md from "@ts-common/commonmark-to-markdown";
import * as openapiMarkdown from "@azure/openapi-markdown";
import { TYPES } from "../inversifyUtils";
import { FileLoader, FileLoaderOption } from "../swagger/fileLoader";
import { setDefaultOpts } from "./../swagger/loader";
import { TestResources } from "./testResourceTypes";

export interface ReadmeTestFileLoaderOption extends FileLoaderOption {}

export interface ReadmeTestDefinition {
  [tag: string]: TestResources;
}

@injectable()
export class ReadmeTestFileLoader {
  // eslint-disable-next-line @typescript-eslint/explicit-member-accessibility
  constructor(
    @inject(TYPES.opts) private opts: ReadmeTestFileLoaderOption,
    private fileloader: FileLoader
  ) {
    setDefaultOpts(this.opts, { checkUnderFileRoot: false });
  }

  public async load(filePath: string): Promise<ReadmeTestDefinition> {
    const content = await this.fileloader.load(filePath);
    const ret = ReadmeTestFileLoader.parse(content);
    return ret;
  }

  public static parse(content: string): ReadmeTestDefinition {
    const ret: ReadmeTestDefinition = {};
    const m = md.parse(content);
    for (const node of md.iterate(m.markDown)) {
      if (node.type === "code_block") {
        const tag = getTagFromBlockInfo(node.info || "");
        if (tag !== undefined) {
          const testResources: TestResources = load(node.literal || "");
          ret[tag] = testResources;
        }
      }
    }
    return ret;
  }

  public async writeFile(filePath: string, readmeTestDef: ReadmeTestDefinition) {
    let content = "";
    const readmeBuilder = new openapiMarkdown.ReadMeBuilder();
    for (const [tag, testResource] of Object.entries(readmeTestDef)) {
      content += readmeBuilder.getVersionDefinition(testResource, tag);
    }
    await this.fileloader.writeFile(filePath, content);
  }
}

function getTagFromBlockInfo(blockInfo: string): string | undefined {
  const regex = /\$\(tag\)\s*==\s*'(\S+)'/;
  const result = blockInfo.match(regex);
  if (result !== null) {
    return result[1];
  }
  return undefined;
}
